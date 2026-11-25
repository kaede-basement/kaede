use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use zip::ZipArchive;

#[derive(Deserialize)]
pub struct ArchiveFile {
    pub path: String,
    #[serde(default)]
    pub exclude: Vec<String>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum UnzipOutcome {
    // Always 'true'
    Success(bool),
    Error(String),
}

// Reads a file inside the archive without extracting the whole archive
#[tauri::command]
pub async fn read_archive_entry(
    archive_path: String,
    entry_path: String,
) -> Result<Option<Vec<u8>>, String> {
    tokio::task::spawn_blocking(move || read_entry(Path::new(&archive_path), &entry_path))
        .await
        .map_err(|join_error| join_error.to_string())?
}

fn read_entry(archive_path: &Path, entry_path: &str) -> Result<Option<Vec<u8>>, String> {
    let mut archive = open_archive(archive_path)?;
    let mut entry = match archive.by_name(entry_path) {
        Ok(entry) => entry,
        Err(zip::result::ZipError::FileNotFound) => return Ok(None),
        Err(error) => {
            return Err(format!(
                "Failed to read the '{}' entry in {}: {}",
                entry_path,
                archive_path.display(),
                error,
            ));
        }
    };

    if entry.is_dir() {
        return Ok(None);
    }

    read_limited(&mut entry, MEMORY_ENTRY_LIMIT).map(Some)
}

const MEMORY_ENTRY_LIMIT: u64 = 16 << 20;

pub(crate) fn open_archive(archive_path: &Path) -> Result<ZipArchive<File>, String> {
    let file = File::open(archive_path)
        .map_err(|error| format!("Failed to open {}: {}", archive_path.display(), error))?;

    ZipArchive::new(file).map_err(|error| {
        format!(
            "Failed to read {} as a zip: {}",
            archive_path.display(),
            error
        )
    })
}

pub(crate) fn read_limited(reader: impl Read, limit: u64) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    reader
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > limit {
        return Err(format!("Archive exceeds decoded byte limit ({limit})"));
    }
    Ok(bytes)
}

pub(crate) fn relative_name(name: &str) -> Result<&Path, String> {
    let name = name.strip_suffix('/').unwrap_or(name);
    for part in name.split('/') {
        let stem = part
            .split('.')
            .next()
            .unwrap_or("")
            .trim_end()
            .to_ascii_uppercase();
        if part.is_empty()
            || part.ends_with(['.', ' '])
            || part.contains(['\\', ':', '\0'])
            || matches!(
                stem.as_str(),
                "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
            )
            || (stem.starts_with("COM") || stem.starts_with("LPT"))
                && stem.chars().count() == 4
                && stem.ends_with(|c: char| c.is_ascii_digit() || "¹²³".contains(c))
        {
            return Err(format!("Unsafe archive path: {name}"));
        }
    }
    Ok(Path::new(name))
}

pub(crate) struct Extraction {
    root: PathBuf,
    directories: HashSet<PathBuf>,
}

impl Extraction {
    pub fn new(root: &Path) -> Result<Self, String> {
        fs::create_dir_all(root).map_err(|e| e.to_string())?;
        Ok(Self {
            root: root.canonicalize().map_err(|e| e.to_string())?,
            directories: HashSet::new(),
        })
    }

    fn directory(&mut self, parent: &Path) -> Result<(), String> {
        let mut path = self.root.clone();
        for component in parent.iter() {
            path.push(component);
            if self.directories.contains(&path) {
                continue;
            }
            match fs::create_dir(&path) {
                Ok(()) => {}
                Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
                    if !fs::symlink_metadata(&path)
                        .map_err(|e| e.to_string())?
                        .is_dir()
                        || path.canonicalize().map_err(|e| e.to_string())? != path
                    {
                        return Err(format!("Linked extraction directory: {}", path.display()));
                    }
                }
                Err(e) => return Err(e.to_string()),
            }
            self.directories.insert(path.clone());
        }
        Ok(())
    }

    pub fn prepare_file(&mut self, name: &str) -> Result<PathBuf, String> {
        let relative = relative_name(name)?;
        self.directory(relative.parent().unwrap())?;
        Ok(self.root.join(relative))
    }

    pub fn extract(
        &mut self,
        name: &str,
        directory: bool,
        mode: Option<u32>,
        mut reader: impl Read,
    ) -> Result<(), String> {
        if directory {
            self.directory(relative_name(name)?)?;
            return Ok(());
        }
        let path = self.prepare_file(name)?;
        let mut output =
            tempfile::NamedTempFile::new_in(path.parent().unwrap()).map_err(|e| e.to_string())?;
        io::copy(&mut reader, &mut output).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        if let Some(mode) = mode {
            use std::os::unix::fs::PermissionsExt;
            output
                .as_file()
                .set_permissions(fs::Permissions::from_mode(mode & 0o777))
                .map_err(|e| e.to_string())?;
        }
        #[cfg(not(unix))]
        let _ = mode;
        let mut temporary = output.into_temp_path();
        fs::rename(&temporary, path).map_err(|e| e.to_string())?;
        temporary.disable_cleanup(true);
        Ok(())
    }
}

#[tauri::command]
pub async fn unzip_files(archive_files: Vec<ArchiveFile>, target_dir_path: String) -> UnzipOutcome {
    let result = tokio::task::spawn_blocking(move || {
        let mut extraction = Extraction::new(Path::new(&target_dir_path))?;
        let mut errors = Vec::new();
        for file in archive_files {
            if let Err(error) = extract_archive(&file, &mut extraction) {
                errors.push(error);
            }
        }
        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors.join("\n"))
        }
    })
    .await;
    match result {
        Ok(Ok(())) => UnzipOutcome::Success(true),
        Ok(Err(e)) => UnzipOutcome::Error(e),
        Err(e) => UnzipOutcome::Error(e.to_string()),
    }
}

fn extract_archive(file: &ArchiveFile, extraction: &mut Extraction) -> Result<(), String> {
    let mut archive = open_archive(Path::new(&file.path))?;
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if file
            .exclude
            .iter()
            .any(|prefix| entry.name().starts_with(prefix))
        {
            continue;
        }
        let name = entry.name().to_owned();
        extraction.extract(&name, entry.is_dir(), entry.unix_mode(), entry)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn archive_names_are_confined_on_every_host() {
        for name in [
            "../x",
            "a/../x",
            "/x",
            "C:/x",
            "a\\..\\x",
            "//server/x",
            "a/NUL.txt",
        ] {
            assert!(relative_name(name).is_err(), "{name}");
        }
        assert!(relative_name("mods/test.jar").is_ok());
    }
    #[test]
    fn cap_checks_actual_output_at_boundary() {
        assert_eq!(read_limited(&b"abc"[..], 3).unwrap(), b"abc");
        assert!(read_limited(&b"abcd"[..], 3).is_err());
    }
    #[test]
    fn failed_entry_preserves_destination_and_consumes_no_extra_disk() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("item");
        fs::write(&path, "old").unwrap();
        let mut extraction = Extraction::new(root.path()).unwrap();
        struct BrokenReader;
        impl Read for BrokenReader {
            fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
                Err(io::ErrorKind::InvalidData.into())
            }
        }
        assert!(extraction
            .extract("item", false, None, BrokenReader)
            .is_err());
        assert_eq!(fs::read(path).unwrap(), b"old");
        assert_eq!(root.path().read_dir().unwrap().count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn linked_parent_is_rejected_before_writing() {
        let root = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(other.path(), root.path().join("linked")).unwrap();
        let mut extraction = Extraction::new(root.path()).unwrap();
        assert!(extraction
            .extract("linked/sub/file", false, None, &b"abc"[..])
            .is_err());
        assert!(!other.path().join("sub").exists());
    }
}
