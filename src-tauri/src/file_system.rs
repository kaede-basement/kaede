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
use std::path::Path;
use md5::Md5;
use rayon::prelude::*;
use serde::Deserialize;
use sha1::Sha1;
use sha2::Sha256;
use crate::hashing::{hash_file, HashAlgorithm};

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
