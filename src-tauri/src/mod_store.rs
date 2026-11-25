use crate::{
    downloads::{client, stream_file, DownloadError, Progress},
    hashing::{modpack_hashes, HashAlgorithm},
    modrinth::ManifestFile,
};
use std::{
    fs, io,
    path::{Path, PathBuf},
};
use tokio::sync::{watch, Mutex, RwLock};

pub struct ModStore {
    cache: PathBuf,
    pub installs: RwLock<()>,
    // A digest and all its mirrors always acquire the same lock.
    shards: [Mutex<()>; 256],
}

impl ModStore {
    pub fn new(base: &Path) -> Self {
        Self {
            cache: base.join("cache"),
            installs: RwLock::new(()),
            shards: std::array::from_fn(|_| Mutex::new(())),
        }
    }

    pub fn prepare(&self) -> io::Result<()> {
        plain_directory(&self.cache)?;
        let objects = self.cache.join("objects");
        plain_directory(&objects)?;
        plain_directory(&objects.join("sha512"))
    }

    pub async fn ensure(
        &self,
        file: &ManifestFile,
        cancel: &mut watch::Receiver<bool>,
    ) -> Result<PathBuf, String> {
        let prefix = &file.sha512[..2];
        let shard = usize::from_str_radix(prefix, 16).map_err(|e| e.to_string())?;
        let _guard = tokio::select! {
            biased;
            _ = cancel.wait_for(|x| *x) => return Err("Installation cancelled".into()),
            guard = self.shards[shard].lock() => guard,
        };
        let parent = self.cache.join("objects/sha512").join(prefix);
        plain_directory(&parent).map_err(|e| e.to_string())?;
        let path = parent.join(&file.sha512);
        let hashes = [
            (HashAlgorithm::Sha512, file.sha512.as_str()),
            (HashAlgorithm::Sha1, file.sha1.as_str()),
        ];
        match fs::symlink_metadata(&path) {
            Ok(meta) if !meta.is_file() => {
                return Err(format!("Invalid object: {}", path.display()))
            }
            Ok(meta) => {
                let source = path.clone();
                let actual = tokio::task::spawn_blocking(move || modpack_hashes(&source))
                    .await
                    .map_err(|e| e.to_string())?
                    .map_err(|e| e.to_string())?;
                if actual.0 == file.sha512 {
                    if actual.1 != file.sha1 || meta.len() != file.file_size {
                        return Err(format!(
                            "Contradictory manifest integrity for {}",
                            file.path
                        ));
                    }
                    return Ok(path);
                }
                fs::remove_file(&path).map_err(|e| e.to_string())?;
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
        let client = client().await?;
        let mut failures = Vec::new();
        for url in std::iter::once(&file.url).chain(&file.mirrors) {
            match stream_file(
                client,
                url,
                &path,
                Some(file.file_size),
                &hashes,
                &Progress::default(),
                cancel,
            )
            .await
            {
                Ok(()) => return Ok(path),
                Err(DownloadError::Cancelled) => return Err("Installation cancelled".into()),
                Err(DownloadError::Other(error)) => failures.push(error),
            }
        }
        Err(format!(
            "All mirrors failed for {}: {}",
            file.path,
            failures.join(", ")
        ))
    }

    async fn clear(&self) -> Result<(), String> {
        let _guard = self.installs.write().await;
        let cache = self.cache.clone();
        tokio::task::spawn_blocking(move || {
            match fs::symlink_metadata(&cache) {
                Ok(m) if ordinary_directory(&m) => (),
                Ok(_) => return Err("Invalid cache directory".into()),
                Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
                Err(e) => return Err(e.to_string()),
            }
            let objects = cache.join("objects");
            match fs::symlink_metadata(&objects) {
                Ok(meta) if ordinary_directory(&meta) => (),
                Ok(_) => return Err("Invalid object directory".into()),
                Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
                Err(e) => return Err(e.to_string()),
            }
            match fs::remove_dir_all(objects) {
                Ok(()) => Ok(()),
                Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
                Err(e) => Err(e.to_string()),
            }
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

fn ordinary_directory(meta: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        if meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return false;
        }
    }
    meta.is_dir()
}

fn plain_directory(path: &Path) -> io::Result<()> {
    match fs::create_dir(path) {
        Err(e)
            if e.kind() == io::ErrorKind::AlreadyExists
                && ordinary_directory(&fs::symlink_metadata(path)?) =>
        {
            Ok(())
        }
        result => result,
    }
}

#[tauri::command]
pub async fn clear_mod_cache(store: tauri::State<'_, ModStore>) -> Result<(), String> {
    store.clear().await
}

pub fn materialize_blob(src: &Path, dst: &Path) -> io::Result<()> {
    let parent = dst
        .parent()
        .ok_or_else(|| io::Error::other("Missing destination directory"))?;
    #[cfg(target_os = "macos")]
    {
        use std::{ffi::CString, os::unix::ffi::OsStrExt};
        let stage = tempfile::tempdir_in(parent)?;
        let copy = stage.path().join("clone");
        let from = CString::new(src.as_os_str().as_bytes())?;
        let to = CString::new(copy.as_os_str().as_bytes())?;
        // Both strings live for the call and clonefile creates a new file.
        if unsafe { libc::clonefile(from.as_ptr(), to.as_ptr(), 0) } == 0 {
            return tempfile::TempPath::from_path(copy)
                .persist_noclobber(dst)
                .map_err(|error| error.error);
        }
    }
    let stage = crate::file_system::staging_file(parent)?;
    #[cfg(target_os = "linux")]
    let cloned = {
        use std::os::fd::AsRawFd;
        let source = fs::File::open(src)?;
        const FICLONE: libc::Ioctl = 0x4004_9409;
        // The kernel borrows both open file descriptors for this call.
        unsafe { libc::ioctl(stage.as_file().as_raw_fd(), FICLONE, source.as_raw_fd()) == 0 }
    };
    #[cfg(not(target_os = "linux"))]
    let cloned = false;
    if !cloned {
        fs::copy(src, stage.path())?;
    }
    stage
        .persist_noclobber(dst)
        .map(|_| ())
        .map_err(|e| e.error)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn clear_only_removes_objects_and_waits_for_install() {
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        fs::create_dir_all(store.cache.join("objects/sha512")).unwrap();
        for file in ["index.json", "pack.mrpack", "objects/sha512/blob"] {
            fs::write(store.cache.join(file), file).unwrap();
        }
        let guard = store.installs.read().await;
        let clear = store.clear();
        tokio::pin!(clear);
        assert!(futures_util::poll!(&mut clear).is_pending());
        drop(guard);
        clear.await.unwrap();
        assert!(!store.cache.join("objects").exists());
        for file in ["index.json", "pack.mrpack"] {
            assert_eq!(fs::read_to_string(store.cache.join(file)).unwrap(), file);
        }
    }
}
