/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

use std::io;
use std::path::{Path, PathBuf};

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::application::InitialStateParsedFiles;
use crate::hashing::HashAlgorithm;
use crate::translations::extract_locale;

pub(crate) fn staging_file(parent: &Path) -> io::Result<tempfile::NamedTempFile> {
    // The renamed file keeps its creation attributes, including on Windows.
    tempfile::Builder::new().make_in(parent, |path| {
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        options.open(path)
    })
}

pub(crate) fn persist_temp_path(
    mut temp: tempfile::TempPath,
    dest: &Path,
    replace: bool,
) -> Result<(), tempfile::PathPersistError> {
    let result = if replace {
        std::fs::rename(&temp, dest)
    } else {
        #[cfg(not(windows))]
        return temp.persist_noclobber(dest);
        #[cfg(windows)]
        move_noclobber(&temp, dest)
    };
    match result {
        Ok(()) => {
            temp.disable_cleanup(true);
            Ok(())
        }
        Err(error) => Err(tempfile::PathPersistError { error, path: temp }),
    }
}

#[cfg(windows)]
fn move_noclobber(src: &Path, dst: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    #[link(name = "kernel32")]
    extern "system" {
        fn MoveFileExW(existing: *const u16, destination: *const u16, flags: u32) -> i32;
    }
    let wide = |path: &Path| {
        verbatim_path(
            &std::path::absolute(path)?
                .as_os_str()
                .encode_wide()
                .collect::<Vec<_>>(),
        )
    };
    let src = wide(src)?;
    let dst = wide(dst)?;
    // Both buffers are NUL-terminated. Zero flags preserves an existing destination.
    if unsafe { MoveFileExW(src.as_ptr(), dst.as_ptr(), 0) } == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(any(windows, test))]
fn verbatim_path(absolute: &[u16]) -> io::Result<Vec<u16>> {
    if absolute.contains(&0) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "NUL in Windows path",
        ));
    }
    let slash = u16::from(b'\\');
    let mut wide = Vec::with_capacity(absolute.len() + 9);
    if absolute.starts_with(&[slash, slash]) {
        let device = [slash, slash, u16::from(b'.'), slash];
        let verbatim = [slash, slash, u16::from(b'?'), slash];
        if absolute.starts_with(&verbatim) || absolute.starts_with(&device) {
            wide.extend_from_slice(absolute);
        } else {
            wide.extend(r"\\?\UNC\".encode_utf16());
            wide.extend_from_slice(&absolute[2..]);
        }
    } else {
        wide.extend(r"\\?\".encode_utf16());
        wide.extend_from_slice(absolute);
    }
    wide.push(0);
    Ok(wide)
}

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ParsedFile {
    // For a well-formed JSON
    Loaded { data: Value },
    // The file is empty or does not exist.
    // It will be rewritten with default contents
    Missing,
    // The file exists and is not empty, but has invalid JSON.
    // It will be backed up and a new file with default contents will be created
    Corrupt { raw: String, error: String },
}

async fn load_json_file(path: PathBuf) -> Result<ParsedFile, String> {
    let content = match tokio::fs::read_to_string(&path).await {
        Ok(content) => content,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(ParsedFile::Missing),
        Err(error) => return Err(format!("Failed to read {}: {}", path.display(), error)),
    };

    // Treat empty files as missing (so that they will be rewritten without any corrupt file backups)
    if content.trim().is_empty() {
        return Ok(ParsedFile::Missing);
    }

    match serde_json::from_str::<Value>(&content) {
        Ok(data) => Ok(ParsedFile::Loaded { data }),
        Err(error) => Ok(ParsedFile::Corrupt {
            raw: content,
            error: error.to_string(),
        }),
    }
}

pub async fn load_config_files(base_directory: PathBuf) -> Result<InitialStateParsedFiles, String> {
    let (config, accounts, instances) = tokio::join!(
        load_json_file(base_directory.join("config.json")),
        load_json_file(base_directory.join("accounts.json")),
        load_json_file(base_directory.join("instances.json")),
    );

    let config = config.map_err(|error| error.to_string())?;
    let accounts = accounts.map_err(|error| error.to_string())?;
    let instances = instances.map_err(|error| error.to_string())?;

    let locale = extract_locale(&config);
    let translations = load_json_file(
        base_directory
            .join("translations")
            .join(format!("{locale}.json")),
    )
    .await
    .map_err(|error| error.to_string())?;

    Ok(InitialStateParsedFiles {
        config,
        accounts,
        instances,
        translations,
    })
}

#[derive(Deserialize)]
pub struct Artifact {
    path: String,
    hash: String,
    size: Option<u64>,
}

#[derive(Deserialize)]
#[serde(untagged)]
pub enum ExpectedPath {
    Plain(String),
    Sized { path: String, size: Option<u64> },
}

fn matches_size(path: &Path, size: Option<u64>) -> bool {
    path.metadata()
        .is_ok_and(|meta| meta.is_file() && size.map_or(true, |s| s == meta.len()))
}

#[tauri::command]
pub async fn verify_paths(paths: Vec<ExpectedPath>) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        paths
            .into_par_iter()
            .filter_map(|entry| {
                let (path, size) = match entry {
                    ExpectedPath::Plain(path) => (path, None),
                    ExpectedPath::Sized { path, size } => (path, size),
                };
                (!matches_size(Path::new(&path), size)).then_some(path)
            })
            .collect()
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn verify_paths_hash(
    artifacts: Vec<Artifact>,
    algorithm: HashAlgorithm,
) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let mismatched_paths: Vec<String> = artifacts
            .into_par_iter()
            .filter_map(|artifact| {
                let path = Path::new(&artifact.path);

                let valid = matches_size(path, artifact.size)
                    && (artifact.hash == "ignore"
                        || verify_file_hash(path, &algorithm, &artifact.hash).unwrap_or(false));
                (!valid).then_some(artifact.path)
            })
            .collect();

        Ok(mismatched_paths)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn verify_file_hash(
    path: &Path,
    algorithm: &HashAlgorithm,
    expected_hash: &str,
) -> io::Result<bool> {
    match algorithm.hash(path) {
        Ok(hash) => Ok(hash.eq_ignore_ascii_case(expected_hash)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn fast_verification_accepts_legacy_paths_and_checks_file_sizes() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("item");
        std::fs::write(&file, b"ok").unwrap();
        let paths = serde_json::from_value(
            serde_json::json!([file,dir.path(),{"path":file,"size":2},{"path":file,"size":3}]),
        )
        .unwrap();
        assert_eq!(
            verify_paths(paths).await.unwrap(),
            vec![dir.path().to_str().unwrap(), file.to_str().unwrap()]
        );
    }
    #[test]
    fn windows_publication_paths_preserve_drive_unc_and_device_names() {
        for (input, expected) in [
            (r"C:\a\b", r"\\?\C:\a\b"),
            (r"\\server\share\a", r"\\?\UNC\server\share\a"),
            (r"\\?\C:\a", r"\\?\C:\a"),
            (r"\\?\UNC\server\share\a", r"\\?\UNC\server\share\a"),
            (r"\\.\C:\a", r"\\.\C:\a"),
        ] {
            let wide = verbatim_path(&input.encode_utf16().collect::<Vec<_>>()).unwrap();
            assert_eq!(wide, expected.encode_utf16().chain([0]).collect::<Vec<_>>());
        }
        assert!(verbatim_path(&[0]).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn publishes_beyond_max_path_with_and_without_replacement() {
        let root = tempfile::tempdir().unwrap();
        let parent = root.path().join("a".repeat(128)).join("b".repeat(128));
        std::fs::create_dir_all(&parent).unwrap();
        let dest = parent.join("object");
        let stage = |bytes: &[u8]| {
            let mut file = staging_file(&parent).unwrap();
            std::io::Write::write_all(&mut file, bytes).unwrap();
            file.into_temp_path()
        };
        persist_temp_path(stage(b"first"), &dest, false).unwrap();
        assert_eq!(
            persist_temp_path(stage(b"race"), &dest, false)
                .unwrap_err()
                .error
                .kind(),
            io::ErrorKind::AlreadyExists
        );
        assert_eq!(std::fs::read(&dest).unwrap(), b"first");
        persist_temp_path(stage(b"replacement"), &dest, true).unwrap();
        assert_eq!(std::fs::read(&dest).unwrap(), b"replacement");
        assert_eq!(parent.read_dir().unwrap().count(), 1);
    }

    #[cfg(windows)]
    #[test]
    fn published_file_has_no_temporary_attribute() {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_TEMPORARY: u32 = 0x100;
        let dir = tempfile::tempdir().unwrap();
        let staged = staging_file(dir.path()).unwrap().into_temp_path();
        let destination = dir.path().join("published.jar");
        persist_temp_path(staged, &destination, true).unwrap();
        assert_eq!(
            destination.metadata().unwrap().file_attributes() & FILE_ATTRIBUTE_TEMPORARY,
            0
        );
    }

    #[tokio::test]
    async fn startup_json_preserves_wire_values_locale_and_recovery_text() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        for (input, locale) in [
            (r#"{"other":[0,true],"locale":"fr","locale":"ru"}"#, "ru"),
            (r#"{"locale":"../accounts"}"#, "en"),
            (r#"["ru"]"#, "en"),
        ] {
            std::fs::write(&path, input).unwrap();
            let file = load_json_file(path.clone()).await.unwrap();
            assert_eq!(extract_locale(&file), locale);
            assert_eq!(
                serde_json::to_value(&file).unwrap(),
                serde_json::json!({
                    "status": "loaded", "data": serde_json::from_str::<serde_json::Value>(input).unwrap()
                })
            );
        }
        for input in [" {broken ", "1e400", r#""\uD800""#] {
            std::fs::write(&path, input).unwrap();
            assert!(
                matches!(load_json_file(path.clone()).await.unwrap(), ParsedFile::Corrupt { raw, .. } if raw == input)
            );
        }
    }
}
