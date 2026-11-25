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

use std::fs::File;
use std::io;
use std::io::Read;
use std::path::Path;

use md5::Md5;
use serde::Deserialize;
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

pub(crate) fn to_hex(digest: &[u8]) -> String {
    let mut hex = String::with_capacity(digest.len() * 2);

    for byte in digest {
        const DIGITS: &[u8; 16] = b"0123456789abcdef";
        hex.push(DIGITS[(byte >> 4) as usize] as char);
        hex.push(DIGITS[(byte & 15) as usize] as char);
    }

    hex
}

fn read_chunks(path: &Path, mut update: impl FnMut(&[u8])) -> io::Result<()> {
    let mut file = File::open(path)?;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let len = file.read(&mut buffer)?;
        if len == 0 {
            return Ok(());
        }
        update(&buffer[..len]);
    }
}

pub fn hash_file<D: Digest>(path: &Path) -> io::Result<String> {
    let mut digest = D::new();
    read_chunks(path, |chunk| digest.update(chunk))?;
    Ok(to_hex(&digest.finalize()))
}

pub fn modpack_hashes(path: &Path) -> io::Result<(String, String)> {
    let mut sha512 = sha2::Sha512::new();
    let mut sha1 = Sha1::new();
    read_chunks(path, |chunk| {
        sha512.update(chunk);
        sha1.update(chunk);
    })?;
    Ok((to_hex(&sha512.finalize()), to_hex(&sha1.finalize())))
}

pub fn hash_bytes<HashAlgorithm: Digest>(bytes: &[u8]) -> String {
    to_hex(&HashAlgorithm::digest(bytes))
}

pub(crate) static APPLICATION_HASH: OnceCell<String> = OnceCell::const_new();

pub async fn get_executable_hash() -> Result<String, String> {
    tokio::task::spawn_blocking(|| hash_file::<Sha256>(&std::env::current_exe()?))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum HashAlgorithm {
    Sha512,
    Sha256,
    Sha1,
    Md5,
}

impl HashAlgorithm {
    pub fn hasher(self) -> Box<dyn sha2::digest::DynDigest + Send> {
        match self {
            Self::Sha1 => Box::new(Sha1::new()),
            Self::Sha512 => Box::new(sha2::Sha512::new()),
            Self::Sha256 => Box::new(Sha256::new()),
            Self::Md5 => Box::new(Md5::new()),
        }
    }

    pub fn validate(self, hash: &str) -> Result<(), String> {
        let length = match self {
            Self::Sha1 => 40,
            Self::Sha512 => 128,
            Self::Sha256 => 64,
            Self::Md5 => 32,
        };
        if hash.len() == length && hash.bytes().all(|b| b.is_ascii_hexdigit()) {
            Ok(())
        } else {
            Err(format!("Invalid {self:?} digest"))
        }
    }

    pub fn hash(&self, path: &Path) -> io::Result<String> {
        match self {
            Self::Sha512 => hash_file::<sha2::Sha512>(path),
            Self::Sha256 => hash_file::<Sha256>(path),
            Self::Sha1 => hash_file::<Sha1>(path),
            Self::Md5 => hash_file::<Md5>(path),
        }
    }
}

#[tauri::command]
pub async fn hash_path(path: String, kind: HashAlgorithm) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let file_path = Path::new(&path);

        kind.hash(file_path)
            .map_err(|error| format!("Failed to hash {path}: {error}"))
    })
    .await
    .map_err(|error| error.to_string())?
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hex_preserves_leading_zeroes() {
        assert_eq!(to_hex(&[0, 1, 15, 16, 254, 255]), "00010f10feff");
        assert_eq!(
            hash_bytes::<Md5>(b"abc"),
            "900150983cd24fb0d6963f7d28e17f72"
        );
    }
}
