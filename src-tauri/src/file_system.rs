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

use md5::Md5;
use sha1::Sha1;
use sha2::Sha256;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::application::InitialStateParsedFiles;
use crate::hashing::{hash_file, HashAlgorithm};
use crate::translations::extract_locale;

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
        base_directory.join("translations").join(format!("{locale}.json")),
    ).await.map_err(|error| error.to_string())?;

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
    }).await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn verify_paths_hash(artifacts: Vec<Artifact>, algorithm: HashAlgorithm) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let mismatched_paths: Vec<String> = artifacts
            .par_iter()
            .filter_map(|artifact| {
                let path = Path::new(&artifact.path);

                if !path.exists() {
                    return Some(artifact.path.clone());
                }

                // Artifacts that did not specify SHA1 hashes have been assigned to 'ignore' in JS
                if artifact.hash == "ignore" {
                    return None;
                }

                match verify_file_hash(path, &algorithm, &artifact.hash) {
                    Ok(is_valid) => {
                        if !is_valid {
                            Some(artifact.path.clone())
                        } else {
                            None
                        }
                    }
                    Err(_) => Some(artifact.path.clone()),
                }
            })
            .collect();

        Ok(mismatched_paths)
    }).await.map_err(|error| error.to_string())?
}

fn verify_file_hash(path: &Path, algorithm: &HashAlgorithm, expected_hash: &str) -> io::Result<bool> {
    let hash = match algorithm {
        HashAlgorithm::Sha256 => hash_file::<Sha256>(path),
        HashAlgorithm::Sha1   => hash_file::<Sha1>(path),
        HashAlgorithm::Md5    => hash_file::<Md5>(path),
    }?;

    Ok(hash == expected_hash)
}
