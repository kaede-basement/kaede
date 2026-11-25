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

use std::io::{self, Write};
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

fn accounts_destination(base: &Path) -> io::Result<PathBuf> {
    let path = base.join("accounts.json");
    match std::fs::symlink_metadata(&path) {
        Ok(_) => {
            let target = std::fs::canonicalize(&path)?;
            if !std::fs::metadata(&target)?.is_file() {
                return Err(io::Error::other("Account store is not a regular file"));
            }
            Ok(target)
        }
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            Ok(std::fs::canonicalize(base)?.join("accounts.json"))
        }
        Err(e) => Err(e),
    }
}

fn publish_accounts(
    destination: &Path,
    create_new: bool,
    write: impl FnOnce(&mut std::fs::File) -> io::Result<()>,
) -> io::Result<()> {
    let parent = destination
        .parent()
        .ok_or_else(|| io::Error::other("Missing accounts directory"))?;
    #[cfg(windows)]
    let mut staged =
        tempfile::Builder::new().make_in(parent, crate::private_account_file::create)?;
    #[cfg(not(windows))]
    let mut staged = staging_file(parent)?;
    write(staged.as_file_mut())?;
    staged.as_file().sync_all()?;
    let mut staged = staged.into_temp_path();
    if create_new {
        staged.persist_noclobber(destination)?;
    } else {
        std::fs::rename(&staged, destination)?;
        staged.disable_cleanup(true);
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum AccountsFile {
    Missing,
    Empty { raw: String },
    Content { raw: String },
    InvalidUtf8,
}

#[tauri::command]
pub async fn read_accounts_file(base_directory: PathBuf) -> Result<AccountsFile, String> {
    let path = base_directory.join("accounts.json");
    match tokio::fs::read_to_string(&path).await {
        Ok(raw) if json_without_bom(&raw).trim().is_empty() => Ok(AccountsFile::Empty { raw }),
        Ok(raw) => Ok(AccountsFile::Content { raw }),
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            match tokio::fs::symlink_metadata(path).await {
                Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(AccountsFile::Missing),
                Err(e) => Err(e.to_string()),
                Ok(_) => Err("Cannot resolve accounts.json".into()),
            }
        }
        Err(e) if e.kind() == io::ErrorKind::InvalidData => Ok(AccountsFile::InvalidUtf8),
        Err(e) => Err(e.to_string()),
    }
}

const ACCOUNT_CONFLICT: &str = "accounts-conflict";
static ACCOUNT_WRITE: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[tauri::command]
pub async fn save_accounts(
    base_directory: PathBuf,
    contents: String,
    create_new: bool,
    expected_previous: Option<String>,
) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let _guard = ACCOUNT_WRITE.lock().map_err(|e| e.to_string())?;
        let destination = accounts_destination(&base_directory).map_err(|e| e.to_string())?;
        if let Some(previous) = expected_previous {
            match std::fs::read(&destination) {
                Ok(bytes) if bytes == previous.as_bytes() => {}
                Ok(_) => return Err(ACCOUNT_CONFLICT.to_owned()),
                Err(e) if e.kind() == io::ErrorKind::NotFound => {
                    return Err(ACCOUNT_CONFLICT.to_owned())
                }
                Err(e) => return Err(e.to_string()),
            }
        }
        publish_accounts(&destination, create_new, |file| {
            file.write_all(contents.as_bytes())
        })
        .map_err(|e| {
            if create_new && e.kind() == io::ErrorKind::AlreadyExists {
                ACCOUNT_CONFLICT.to_owned()
            } else {
                e.to_string()
            }
        })?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ParsedFile {
    // For a well-formed JSON
    Loaded { data: Value },
    // The file is empty or does not exist.
    // It will be rewritten with default contents
    Missing,
    Unreadable,
    // The file exists and is not empty, but has invalid JSON.
    // It will be backed up and a new file with default contents will be created
    Corrupt { raw: String, error: String },
}

fn json_without_bom(content: &str) -> &str {
    content.strip_prefix('\u{feff}').unwrap_or(content)
}

async fn load_json_file(path: PathBuf) -> Result<ParsedFile, String> {
    let content = match tokio::fs::read_to_string(&path).await {
        Ok(content) => content,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(ParsedFile::Missing),
        Err(error) => return Err(format!("Failed to read {}: {}", path.display(), error)),
    };

    // Treat empty files as missing (so that they will be rewritten without any corrupt file backups)
    let json = json_without_bom(&content);
    if json.trim().is_empty() {
        return Ok(ParsedFile::Missing);
    }

    match serde_json::from_str::<Value>(json) {
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
    let accounts = accounts.unwrap_or(ParsedFile::Unreadable);
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
    #[test]
    fn failed_partial_account_write_preserves_original_and_retry_publishes() {
        let dir = tempfile::tempdir().unwrap();
        let destination = dir.path().join("accounts.json");
        let save = |data: &[u8], create_new| {
            publish_accounts(&destination, create_new, |file| file.write_all(data))
        };
        save(b"original", true).unwrap();
        let interrupted = publish_accounts(&destination, false, |file| {
            file.write_all(b"partial")?;
            Err(io::Error::other("disk full"))
        });
        assert!(interrupted.is_err());
        assert!(save(b"raced", true).is_err());
        assert_eq!(std::fs::read(&destination).unwrap(), b"original");
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
        save(b"complete", false).unwrap();
        assert_eq!(std::fs::read(&destination).unwrap(), b"complete");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                destination.metadata().unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn linked_accounts_publish_privately_beside_the_target() {
        use std::os::unix::fs::{symlink, PermissionsExt};

        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().join("launcher");
        let store = dir.path().join("profile");
        std::fs::create_dir(&base).unwrap();
        std::fs::create_dir(&store).unwrap();
        let target = store.join("credentials.json");
        std::fs::write(&target, "original").unwrap();
        let link = base.join("accounts.json");
        symlink("../profile/credentials.json", &link).unwrap();
        save_accounts(
            base.clone(),
            "updated".into(),
            false,
            Some("original".into()),
        )
        .await
        .unwrap();
        assert_eq!(
            std::fs::read_link(&link).unwrap(),
            Path::new("../profile/credentials.json")
        );
        assert_eq!(std::fs::read(&target).unwrap(), b"updated");
        assert_eq!(
            std::fs::metadata(&target).unwrap().permissions().mode() & 0o777,
            0o600
        );
        std::fs::remove_file(&target).unwrap();
        for create_new in [false, true] {
            assert!(
                save_accounts(base.clone(), "replacement".into(), create_new, None)
                    .await
                    .is_err()
            );
        }
        assert!(read_accounts_file(base).await.is_err());
        assert!(link.is_symlink());
        assert!(!target.exists());
    }

    #[tokio::test]
    async fn strict_account_reads_and_compare_exchange_preserve_intervening_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().to_owned();
        let path = base.join("accounts.json");
        let initial = " \t";
        std::fs::write(&path, initial).unwrap();
        let AccountsFile::Empty { raw } = read_accounts_file(base.clone()).await.unwrap() else {
            panic!("expected empty store");
        };
        save_accounts(base.clone(), "[]".into(), false, Some(raw.clone()))
            .await
            .unwrap();
        assert_eq!(
            save_accounts(base.clone(), "[1]".into(), false, Some(raw))
                .await
                .unwrap_err(),
            ACCOUNT_CONFLICT
        );
        assert_eq!(std::fs::read(&path).unwrap(), b"[]");
        let invalid = b"[\"\xff\"]";
        std::fs::write(&path, invalid).unwrap();
        assert!(matches!(
            read_accounts_file(base.clone()).await.unwrap(),
            AccountsFile::InvalidUtf8
        ));
        assert!(matches!(
            load_config_files(base.clone()).await.unwrap().accounts,
            ParsedFile::Unreadable
        ));
        assert_eq!(
            save_accounts(base, "[]".into(), false, Some("[]".into()))
                .await
                .unwrap_err(),
            ACCOUNT_CONFLICT
        );
        assert_eq!(std::fs::read(path).unwrap(), invalid);
    }

    #[tokio::test]
    async fn account_bom_is_ignored_only_for_parsing() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().to_owned();
        let path = base.join("accounts.json");
        let original = "\u{feff}[]";
        std::fs::write(&path, original).unwrap();
        assert!(
            matches!(load_config_files(base.clone()).await.unwrap().accounts,
            ParsedFile::Loaded { data } if data == serde_json::json!([]))
        );
        let AccountsFile::Content { raw } = read_accounts_file(base.clone()).await.unwrap() else {
            panic!("expected account content");
        };
        assert_eq!(raw, original);
        assert_eq!(
            save_accounts(base.clone(), "[1]".into(), false, Some("[]".into()))
                .await
                .unwrap_err(),
            ACCOUNT_CONFLICT
        );
        assert_eq!(std::fs::read(&path).unwrap(), original.as_bytes());
        save_accounts(base.clone(), "[1]".into(), false, Some(raw))
            .await
            .unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"[1]");
        std::fs::write(&path, "\u{feff}{broken").unwrap();
        assert!(matches!(load_config_files(base).await.unwrap().accounts,
            ParsedFile::Corrupt { raw, .. } if raw == "\u{feff}{broken"));
    }

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
    #[cfg(windows)]
    #[test]
    fn published_file_has_no_temporary_attribute() {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_TEMPORARY: u32 = 0x100;
        let dir = tempfile::tempdir().unwrap();
        let mut staged = staging_file(dir.path()).unwrap().into_temp_path();
        let destination = dir.path().join("published.jar");
        std::fs::rename(&staged, &destination).unwrap();
        staged.disable_cleanup(true);
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
