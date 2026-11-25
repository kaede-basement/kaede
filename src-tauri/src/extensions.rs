///
/// ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning),
/// but the code here was initially written by me in TypeScript (so this is a rewrite)
///
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};
use zip::ZipArchive;

const METADATA_ENTRY: &str = "metadata.json";
const CODE_ENTRY: &str = "index.js";

const MAX_METADATA_SIZE: u64 = 64 * 1024;
const MAX_CODE_SIZE: u64 = 16 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionFile {
    pub file_name: String,
    pub metadata: serde_json::Value,
    pub code: String,
    pub artifact_sha256: String,
    pub code_sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionFailure {
    pub file_name: String,
    pub error: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionsReadResult {
    pub extensions: Vec<ExtensionFile>,
    pub failures: Vec<ExtensionFailure>,
}

fn is_extension_archive(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|extension| extension.to_str()) else {
        return false;
    };

    extension.eq_ignore_ascii_case("zip") || extension.eq_ignore_ascii_case("kaede")
}

fn read_entry_text(
    archive: &mut ZipArchive<File>,
    entry_name: &str,
    max_size: u64,
) -> Result<(String, bool), String> {
    let entry = archive.by_name(entry_name).map_err(|error| {
        format!(
            "Could not find '{}' at the archive root: {}",
            entry_name, error
        )
    })?;
    let declared_size = entry.size();

    if declared_size > max_size {
        return Err(format!(
            "'{}' declares {} bytes which exceeds the {} bytes limit",
            entry_name, declared_size, max_size,
        ));
    }

    let mut contents = String::new();
    let mut limited_reader = entry.take(max_size + 1);

    let mut prefix = Vec::with_capacity(3);
    limited_reader
        .by_ref()
        .take(3)
        .read_to_end(&mut prefix)
        .map_err(|error| format!("Could not read '{entry_name}': {error}"))?;
    let bom = prefix == b"\xef\xbb\xbf";
    if bom {
        prefix.clear();
    }
    prefix
        .as_slice()
        .chain(limited_reader)
        .read_to_string(&mut contents)
        .map_err(|error| format!("Could not read '{}' as UTF-8 text: {}", entry_name, error))?;

    if contents.len() as u64 + if bom { 3 } else { 0 } > max_size {
        return Err(format!(
            "'{}' decompressed past the {} bytes limit",
            entry_name, max_size,
        ));
    }

    Ok((contents, bom))
}

fn extension_hashes(
    metadata: &str,
    metadata_bom: bool,
    code: &str,
    code_bom: bool,
) -> (String, String) {
    let code_digest = Sha256::digest(code.as_bytes());
    let artifact = Sha256::new()
        .chain_update([metadata_bom as u8])
        .chain_update(metadata.as_bytes())
        .chain_update([code_bom as u8])
        .chain_update(code_digest)
        .finalize();
    (format!("{code_digest:x}"), format!("{artifact:x}"))
}

fn read_archive(path: &Path, file_name: &str) -> Result<ExtensionFile, String> {
    let file = File::open(path)
        .map_err(|error| format!("Failed to open {}: {}", path.display(), error))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("Failed to read {} as a zip: {}", path.display(), error))?;

    let (metadata_text, metadata_bom) =
        read_entry_text(&mut archive, METADATA_ENTRY, MAX_METADATA_SIZE)?;
    let metadata: serde_json::Value = serde_json::from_str(&metadata_text)
        .map_err(|error| format!("'{}' is not valid JSON: {}", METADATA_ENTRY, error))?;
    let (code, code_bom) = read_entry_text(&mut archive, CODE_ENTRY, MAX_CODE_SIZE)?;

    let (code_sha256, artifact_sha256) =
        extension_hashes(&metadata_text, metadata_bom, &code, code_bom);
    Ok(ExtensionFile {
        file_name: file_name.into(),
        metadata,
        code,
        code_sha256,
        artifact_sha256,
    })
}

#[tauri::command]
pub async fn read_extensions(extensions_dir_path: String) -> Result<ExtensionsReadResult, String> {
    let extensions_dir = PathBuf::from(extensions_dir_path);

    tokio::task::spawn_blocking(move || {
        let entries = std::fs::read_dir(&extensions_dir)
            .map_err(|error| format!("Failed to read {}: {}", extensions_dir.display(), error))?;

        let mut archive_paths: Vec<PathBuf> = Vec::new();

        for entry in entries {
            let entry = entry.map_err(|error| {
                format!(
                    "Failed to read an entry of {}: {}",
                    extensions_dir.display(),
                    error
                )
            })?;
            let path = entry.path();

            if !is_extension_archive(&path) {
                continue;
            }
            let kind = entry
                .file_type()
                .map_err(|error| format!("Failed to stat {}: {}", path.display(), error))?;
            if kind.is_file() || (kind.is_symlink() && path.is_file()) {
                archive_paths.push(path);
            }
        }

        // Sort so that extensions always load in the same order
        archive_paths.sort();

        let mut extensions: Vec<ExtensionFile> = Vec::new();
        let mut failures: Vec<ExtensionFailure> = Vec::new();

        // One broken archive should not prevent other extensions from loading,
        // so per-archive errors are collected instead of failing the whole command
        for path in archive_paths {
            let file_name = path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default();

            match read_archive(&path, &file_name) {
                Ok(extension) => extensions.push(extension),
                Err(error) => failures.push(ExtensionFailure { file_name, error }),
            }
        }

        Ok(ExtensionsReadResult {
            extensions,
            failures,
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::extension_hashes;

    #[cfg(unix)]
    #[tokio::test]
    async fn discovers_symlinked_archives() {
        use std::path::PathBuf;
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::{fs, io::Write, os::unix::fs::symlink};

        struct TempDir(PathBuf);
        impl Drop for TempDir {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let directory = loop {
            let n = NEXT.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir()
                .join(format!("kaede-linked-archive-{}-{n}", std::process::id()));
            match fs::create_dir(&path) {
                Ok(()) => break TempDir(path),
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => panic!("Creating test directory: {error}"),
            }
        };
        let target = directory.0.join("archive");
        let mut archive = zip::ZipWriter::new(fs::File::create(&target).unwrap());
        for (name, data) in [("metadata.json", "{}"), ("index.js", "")] {
            archive
                .start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive.write_all(data.as_bytes()).unwrap();
        }
        drop(archive.finish().unwrap());
        symlink(target, directory.0.join("linked.kaede")).unwrap();

        let result = super::read_extensions(directory.0.to_str().unwrap().into()).await;
        let files = result.unwrap().extensions;
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].file_name, "linked.kaede");
    }

    #[test]
    fn identity_covers_both_files_and_their_boundary() {
        let (code, artifact) = extension_hashes("{}", false, "abc", false);
        assert_eq!(
            code,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        for (metadata, metadata_bom, js, code_bom) in [
            ("{ }", false, "abc", false),
            ("{}a", false, "bc", false),
            ("{}", false, "abd", false),
            ("{}", true, "abc", false),
            ("{}", false, "abc", true),
        ] {
            assert_ne!(
                artifact,
                extension_hashes(metadata, metadata_bom, js, code_bom).1
            );
        }
    }
}
