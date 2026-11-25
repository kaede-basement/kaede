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
}

#[tauri::command]
pub async fn verify_paths(paths: Vec<String>) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        paths
            .into_par_iter()
            .filter(|path| !Path::new(path).exists())
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

                let valid = if artifact.hash == "ignore" {
                    path.exists()
                } else {
                    verify_file_hash(path, &algorithm, &artifact.hash).unwrap_or(false)
                };
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
        Ok(hash) => Ok(hash == expected_hash),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
