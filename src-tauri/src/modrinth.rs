use crate::zip::{open_archive, read_limited, relative_name, Extraction};
///
/// ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning),
/// but the code here was initially written by me in TypeScript (so this is a rewrite)
///
use std::collections::HashMap;
use std::fs::File;
use std::path::Path;

use serde::{Deserialize, Serialize};
use zip::ZipArchive;

const MANIFEST_LIMIT: u64 = 16 << 20;
const MANIFEST_ENTRY: &str = "modrinth.index.json";
const OVERRIDE_PREFIXES: [&str; 2] = ["overrides", "client-overrides"];
const TRUSTED_PREFIX: &str = "https://cdn.modrinth.com/";

#[derive(Deserialize, Default)]
struct RawHashes {
    #[serde(default)]
    sha1: String,
    #[serde(default)]
    sha512: String,
}

#[derive(Deserialize)]
struct RawFile {
    path: String,
    #[serde(default)]
    hashes: RawHashes,
    #[serde(default)]
    downloads: Vec<String>,
    #[serde(default, rename = "fileSize")]
    file_size: u64,
}

#[derive(Deserialize)]
struct RawIndex {
    #[serde(default, rename = "formatVersion")]
    format_version: u32,
    #[serde(default)]
    name: String,
    #[serde(default, rename = "versionId")]
    version_id: String,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    dependencies: HashMap<String, String>,
    #[serde(default)]
    files: Vec<RawFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestFile {
    // Relative to the Minecraft directory, e.g., "mods/sodium.jar"
    pub path: String,
    pub url: String,
    pub file_size: u64,
    pub sha1: String,
    pub sha512: String,
    pub external: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MrpackManifest {
    pub format_version: u32,
    pub name: String,
    pub version_id: String,
    pub summary: Option<String>,
    // For example, { "minecraft": "1.20.1", "fabric-loader": "0.15.11" }
    pub dependencies: HashMap<String, String>,
    pub files: Vec<ManifestFile>,
    // How many override entries were written into the target directory
    pub overrides: usize,
}

#[tauri::command]
pub async fn install_mrpack(
    archive_path: String,
    target_dir_path: String,
) -> Result<MrpackManifest, String> {
    tokio::task::spawn_blocking(move || {
        install(Path::new(&archive_path), Path::new(&target_dir_path))
    })
    .await
    .map_err(|join_error| join_error.to_string())?
}

#[tauri::command]
pub async fn peek_mrpack(archive_path: String) -> Result<Option<MrpackManifest>, String> {
    tokio::task::spawn_blocking(move || peek(Path::new(&archive_path)))
        .await
        .map_err(|join_error| join_error.to_string())?
}

fn peek(archive_path: &Path) -> Result<Option<MrpackManifest>, String> {
    read_manifest(&mut open_archive(archive_path)?)
}

fn install(archive_path: &Path, target_dir: &Path) -> Result<MrpackManifest, String> {
    let mut archive = open_archive(archive_path)?;
    let mut manifest = read_manifest(&mut archive)?.ok_or("Missing modrinth.index.json")?;
    let mut extraction = Extraction::new(target_dir)?;
    for file in &manifest.files {
        let path = extraction.prepare_file(&file.path)?;
        match path.symlink_metadata() {
            Ok(meta) if !meta.is_file() => {
                return Err(format!("Invalid manifest destination: {}", path.display()))
            }
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
    }
    manifest.overrides = extract_overrides(&mut archive, archive_path, &mut extraction)?;
    Ok(manifest)
}

fn build_manifest(manifest: RawIndex) -> Result<MrpackManifest, String> {
    Ok(MrpackManifest {
        format_version: manifest.format_version,
        name: manifest.name,
        version_id: manifest.version_id,
        summary: manifest.summary,
        dependencies: manifest.dependencies,
        files: manifest
            .files
            .into_iter()
            .filter_map(|file| map_file(file).transpose())
            .collect::<Result<_, _>>()?,
        overrides: 0,
    })
}

fn map_file(raw: RawFile) -> Result<Option<ManifestFile>, String> {
    if raw.path.ends_with('/') {
        return Err(format!("Expected manifest file: {}", raw.path));
    }
    relative_name(&raw.path)?;
    let Some(url) = raw
        .downloads
        .into_iter()
        .find(|url| url.starts_with("https://"))
    else {
        return Ok(None);
    };

    Ok(Some(ManifestFile {
        external: !url.starts_with(TRUSTED_PREFIX),
        path: raw.path,
        url,
        file_size: raw.file_size,
        sha1: raw.hashes.sha1,
        sha512: raw.hashes.sha512,
    }))
}

fn read_manifest(archive: &mut ZipArchive<File>) -> Result<Option<MrpackManifest>, String> {
    let entry = match archive.by_name(MANIFEST_ENTRY) {
        Ok(entry) => entry,
        Err(zip::result::ZipError::FileNotFound) => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };
    let bytes = read_limited(entry, MANIFEST_LIMIT)?;
    build_manifest(serde_json::from_slice(&bytes).map_err(|e| format!("{MANIFEST_ENTRY}: {e}"))?)
        .map(Some)
}

fn extract_overrides(
    archive: &mut ZipArchive<File>,
    archive_path: &Path,
    extraction: &mut Extraction,
) -> Result<usize, String> {
    let mut written = 0;

    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|error| {
            format!(
                "Failed to read entry #{} in {}: {}",
                index,
                archive_path.display(),
                error,
            )
        })?;

        let Some((prefix, relative)) = entry.name().split_once('/') else {
            continue;
        };
        if !OVERRIDE_PREFIXES.contains(&prefix) || relative.is_empty() {
            continue;
        }
        let directory = entry.is_dir();
        let name = relative.to_owned();
        extraction.extract(&name, directory, None, entry)?;
        written += usize::from(!directory);
    }
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    #[test]
    fn missing_corrupt_and_unsafe_manifest_are_distinct() {
        for contents in [
            None,
            Some("broken"),
            Some(r#"{"files":[{"path":"../outside"}]}"#),
        ] {
            let file = tempfile::NamedTempFile::new().unwrap();
            let mut zip = zip::ZipWriter::new(file.as_file());
            if let Some(contents) = contents {
                zip.start_file(MANIFEST_ENTRY, zip::write::SimpleFileOptions::default())
                    .unwrap();
                zip.write_all(contents.as_bytes()).unwrap();
            }
            zip.finish().unwrap();
            let result = peek(file.path());
            if contents.is_none() {
                assert!(matches!(result, Ok(None)));
            } else {
                assert!(result.is_err());
            }
        }
    }
    #[test]
    fn unreadable_manifest_entry_is_an_error() {
        use std::io::{Seek, SeekFrom};
        let mut file = tempfile::NamedTempFile::new().unwrap();
        let mut archive = zip::ZipWriter::new(file.as_file_mut());
        archive
            .start_file(MANIFEST_ENTRY, zip::write::SimpleFileOptions::default())
            .unwrap();
        archive.write_all(b"{}").unwrap();
        archive.finish().unwrap();
        assert!(matches!(peek(file.path()), Ok(Some(_))));
        file.seek(SeekFrom::Start(0)).unwrap();
        file.write_all(b"oops").unwrap();
        assert!(peek(file.path()).is_err());
    }
}
