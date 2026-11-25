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

use std::fmt::Write;
use std::fs::File;
use std::io;
use std::io::Read;
use std::path::Path;
use log::error;

use serde::Deserialize;
use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256};
use tauri::ipc::{InvokeBody, Request};
use tokio::sync::OnceCell;

fn get_raw_bytes<'a>(request: &'a Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes),
        InvokeBody::Json(_) => Err("Expected raw bytes".to_string()),
    }
}

fn to_hex(digest: &[u8]) -> String {
    let mut hex = String::with_capacity(digest.len() * 2);

    for byte in digest {
        let _ = write!(hex, "{:02x}", byte);
    }

    hex
}

// 'HashAlgorithm' can be SHA1, SHA256, or MD5
pub fn hash_file<HashAlgorithm: Digest>(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = HashAlgorithm::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let bytes_read = file.read(&mut buffer)?;

        if bytes_read == 0 { break }

        hasher.update(&buffer[..bytes_read]);
    }

    Ok(to_hex(&hasher.finalize()))
}

// 'HashAlgorithm' can be SHA1, SHA256, or MD5
pub fn hash_bytes<HashAlgorithm: Digest>(bytes: &[u8]) -> String {
    to_hex(&HashAlgorithm::digest(bytes))
}

pub(crate) static APPLICATION_HASH: OnceCell<String> = OnceCell::const_new();

pub async fn get_executable_hash() -> String {
    if let Some(executable_path) = std::env::current_exe().ok() {
        let hash_join_handle = tokio::task::spawn_blocking(move || {
            hash_file::<Sha256>(&executable_path)
        }).await;

        return match hash_join_handle {
            Ok(Ok(hash)) => hash,
            _ => {
                error!("Failed to calculate the executable hash");
                "no_hash".to_string()
            },
        };
    }

    error!("Failed to get the executable path");
    "no_executable_path_for_hash".to_string()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HashAlgorithm {
    Sha256,
    Sha1,
    Md5
}

#[tauri::command]
pub async fn hash_path(path: String, kind: HashAlgorithm) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let file_path = Path::new(&path);

        match kind {
            HashAlgorithm::Sha256 => { hash_file::<Sha256>(file_path) }
            HashAlgorithm::Sha1   => { hash_file::<Sha1>(file_path) }
            HashAlgorithm::Md5    => { hash_file::<Md5>(file_path) }
        }.map_err(|error| format!("Failed to hash {path}: {error}"))
    }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn hash_request_sha256(request: Request<'_>) -> Result<String, String> {
    Ok(hash_bytes::<Sha256>(get_raw_bytes(&request)?))
}

#[tauri::command]
pub async fn hash_request_sha1(request: Request<'_>) -> Result<String, String> {
    Ok(hash_bytes::<Sha1>(get_raw_bytes(&request)?))
}

#[tauri::command]
pub async fn hash_request_md5(request: Request<'_>) -> Result<String, String> {
    Ok(hash_bytes::<Md5>(get_raw_bytes(&request)?))
}
