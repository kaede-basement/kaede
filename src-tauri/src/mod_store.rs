use crate::{
    downloads::{client, stream_file, CancelSignal, DownloadError, Progress},
    hashing::{modpack_hashes, HashAlgorithm},
    modrinth::ManifestFile,
};
use std::sync::{Arc, Once};
use std::{
    fs, io,
    io::Read,
    path::{Path, PathBuf},
};
use tokio::sync::{watch, Mutex};

#[derive(Clone)]
pub struct ModStore {
    cache: PathBuf,
    active: Arc<Mutex<Option<Arc<ObjectTree>>>>,
    clears: Arc<Mutex<()>>,
    recovery: Arc<Once>,
}

pub struct ObjectTree {
    root: PathBuf,
    shards: [Mutex<()>; 256],
    retired: watch::Sender<()>,
    _lease: watch::Receiver<()>,
}

const INITIAL: &str = "objects";
const ALTERNATE: &str = "objects-next";
const SELECTOR: &str = ".kaede-active-object-tree";

fn other(name: &str) -> &'static str {
    if name == INITIAL {
        ALTERNATE
    } else {
        INITIAL
    }
}

fn selected_tree(cache: &Path) -> io::Result<Option<&'static str>> {
    let path = cache.join(SELECTOR);
    match fs::symlink_metadata(&path) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e),
        Ok(meta) if !meta.is_file() || is_reparse_point(&meta) => {
            return Err(io::Error::other("Invalid object tree selector"))
        }
        Ok(_) => (),
    }
    let mut name = String::new();
    fs::File::open(path)?
        .take(ALTERNATE.len() as u64 + 1)
        .read_to_string(&mut name)?;
    match name.as_str() {
        INITIAL => Ok(Some(INITIAL)),
        ALTERNATE => Ok(Some(ALTERNATE)),
        _ => Err(io::Error::other("Invalid object tree selector")),
    }
}

fn remove_tree(path: &Path) -> io::Result<()> {
    plain_directory(path.parent().unwrap())?;
    match fs::symlink_metadata(path) {
        Ok(meta) if ordinary_directory(&meta) => fs::remove_dir_all(path),
        Ok(_) => Err(io::Error::other("Invalid object directory")),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
}

impl ModStore {
    pub fn new(base: &Path) -> Self {
        Self {
            cache: base.join("cache"),
            active: Arc::default(),
            clears: Arc::default(),
            recovery: Arc::new(Once::new()),
        }
    }

    pub async fn lease(&self) -> Result<Arc<ObjectTree>, String> {
        self.recover_once();
        self.active_tree().await
    }

    async fn active_tree(&self) -> Result<Arc<ObjectTree>, String> {
        let mut active = self.active.clone().lock_owned().await;
        if let Some(tree) = &*active {
            return Ok(tree.clone());
        }
        let cache = self.cache.clone();
        tokio::task::spawn_blocking(move || -> io::Result<_> {
            plain_directory(&cache)?;
            let selected = selected_tree(&cache)?;
            let tree = ObjectTree::new(cache.join(selected.unwrap_or(INITIAL)));
            *active = Some(tree.clone());
            Ok(tree)
        })
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
    }

    fn recover_once(&self) -> Option<tokio::task::JoinHandle<()>> {
        if self.recovery.is_completed() {
            return None;
        }
        // A clear already holding this lock owns retirement. Never queue recovery behind it.
        let serial = self.clears.clone().try_lock_owned().ok()?;
        let mut task = None;
        self.recovery.call_once(|| {
            let cache = self.cache.clone();
            task = Some(tokio::task::spawn_blocking(move || {
                let _serial = serial;
                if let Err(error) = Self::recover(&cache) {
                    log::error!("Cannot retire interrupted mod cache tree: {error}");
                }
            }));
        });
        task
    }

    fn recover(cache: &Path) -> io::Result<()> {
        match fs::symlink_metadata(cache) {
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
            Err(e) => return Err(e),
            Ok(meta) if !ordinary_directory(&meta) => {
                return Err(io::Error::other("Invalid cache directory"))
            }
            Ok(_) => (),
        }
        let active = selected_tree(cache)?.unwrap_or(INITIAL);
        remove_tree(&cache.join(other(active)))
    }

    pub(crate) async fn clear(&self) -> Result<(), String> {
        // Once the selector changes, retirement must run even if the caller goes away.
        let store = self.clone();
        tokio::spawn(async move { store.retire_tree().await })
            .await
            .map_err(|e| e.to_string())?
    }

    async fn retire_tree(&self) -> Result<(), String> {
        let _serial = self.clears.lock().await;
        let old = self.active_tree().await?;
        let name = other(old.root.file_name().unwrap().to_str().unwrap());
        let cache = self.cache.clone();
        let (next, durable) = tokio::task::spawn_blocking(move || -> io::Result<_> {
            plain_directory(&cache)?;
            if selected_tree(&cache)?.unwrap_or(INITIAL) == name {
                return Err(io::Error::other("Object tree changed outside the launcher"));
            }
            remove_tree(&cache.join(name))?;
            let mut selector = crate::file_system::staging_file(&cache)?;
            std::io::Write::write_all(&mut selector, name.as_bytes())?;
            selector.as_file().sync_all()?;
            crate::file_system::persist_temp_path(
                selector.into_temp_path(),
                &cache.join(SELECTOR),
                true,
            )?;
            #[cfg(unix)]
            let durable = fs::File::open(&cache).and_then(|dir| dir.sync_all());
            #[cfg(not(unix))]
            let durable: io::Result<()> = Ok(());
            Ok((ObjectTree::new(cache.join(name)), durable))
        })
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
        // The selector was replaced. Even if the directory sync failed, only this
        // clear may decide whether the old tree is safe to delete.
        self.recovery.call_once(|| {});
        *self.active.lock().await = Some(next);
        let retired = old.retired.clone();
        let path = old.root.clone();
        drop(old);
        retired.closed().await;
        durable.map_err(|e| e.to_string())?;
        tokio::task::spawn_blocking(move || remove_tree(&path))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())
    }
}

impl ObjectTree {
    fn new(root: PathBuf) -> Arc<Self> {
        let (retired, lease) = watch::channel(());
        Arc::new(Self {
            root,
            shards: std::array::from_fn(|_| Mutex::new(())),
            retired,
            _lease: lease,
        })
    }
    pub async fn prepare(self: &Arc<Self>) -> Result<(), String> {
        let tree = self.clone();
        tokio::task::spawn_blocking(move || {
            plain_directory(tree.root.parent().unwrap())?;
            plain_directory(&tree.root)?;
            plain_directory(&tree.root.join("sha512"))
        })
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
    }

    pub async fn ensure(
        self: &Arc<Self>,
        file: &ManifestFile,
        cancel: &CancelSignal,
        siblings: Option<&watch::Receiver<bool>>,
    ) -> Result<PathBuf, DownloadError> {
        let tree = self.clone();
        let file = file.clone();
        crate::downloads::supervise(cancel, siblings, move |mut local| async move {
            tree.ensure_object(&file, &mut local).await
        })
        .await
        .map_err(DownloadError::other)?
    }

    async fn ensure_object(
        self: Arc<Self>,
        file: &ManifestFile,
        cancel: &mut crate::downloads::TransferStop,
    ) -> Result<PathBuf, DownloadError> {
        let prefix = &file.sha512[..2];
        let shard = usize::from_str_radix(prefix, 16).map_err(DownloadError::other)?;
        let _guard = tokio::select! {
            biased;
            _ = cancel.cancelled() => return Err(DownloadError::Cancelled),
            guard = self.shards[shard].lock() => guard,
        };
        let parent = self.root.join("sha512").join(prefix);
        let path = parent.join(&file.sha512);
        let hashes = [
            (HashAlgorithm::Sha512, file.sha512.as_str()),
            (HashAlgorithm::Sha1, file.sha1.as_str()),
        ];
        let cached = {
            let path = path.clone();
            let expected_hash = file.sha512.clone();
            let expected_sha1 = file.sha1.clone();
            let expected_size = file.file_size;
            let name = file.path.clone();
            tokio::task::spawn_blocking(move || {
                plain_directory(&parent).map_err(DownloadError::other)?;
                match fs::symlink_metadata(&path) {
                    Ok(meta) if !meta.is_file() || is_reparse_point(&meta) => {
                        return Err(DownloadError::Other(format!(
                            "Invalid object: {}",
                            path.display()
                        )))
                    }
                    Ok(meta) => {
                        let actual = modpack_hashes(&path).map_err(DownloadError::other)?;
                        if actual.0 == expected_hash {
                            if actual.1 != expected_sha1 || meta.len() != expected_size {
                                return Err(DownloadError::Integrity(format!(
                                    "Contradictory manifest integrity for {}",
                                    name
                                )));
                            }
                            return Ok(true);
                        }
                        fs::remove_file(&path).map_err(DownloadError::other)?;
                    }
                    Err(e) if e.kind() == io::ErrorKind::NotFound => {}
                    Err(e) => return Err(DownloadError::other(e)),
                }
                Ok(false)
            })
            .await
            .map_err(DownloadError::other)??
        };
        if cached {
            return Ok(path);
        }
        let client = client().await.map_err(DownloadError::Other)?;
        let mut failures = Vec::new();
        let mut observed_error: Option<DownloadError> = None;
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
                Err(DownloadError::Cancelled) => {
                    return Err(observed_error.unwrap_or(DownloadError::Cancelled))
                }
                Err(error) => {
                    if observed_error
                        .as_ref()
                        .map_or(true, |old| error.priority() > old.priority())
                    {
                        observed_error = Some(error.clone());
                    }
                    failures.push(error.install_message());
                }
            }
        }
        let details = format!(
            "All mirrors failed for {}: {}",
            file.path,
            failures.join(", ")
        );
        Err(
            if matches!(observed_error, Some(DownloadError::Integrity(_))) {
                DownloadError::Integrity(details)
            } else {
                DownloadError::Other(details)
            },
        )
    }
}

fn is_reparse_point(meta: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    {
        meta.file_type().is_symlink()
    }
}

fn ordinary_directory(meta: &fs::Metadata) -> bool {
    meta.is_dir() && !is_reparse_point(meta)
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

pub fn materialize_blob(src: &Path, dst: &Path) -> io::Result<()> {
    crate::file_system::persist_temp_path(stage_blob(src, dst)?, dst, false).map_err(|e| e.error)
}

pub fn stage_blob(src: &Path, dst: &Path) -> io::Result<tempfile::TempPath> {
    let parent = dst
        .parent()
        .ok_or_else(|| io::Error::other("Missing destination directory"))?;
    #[cfg(target_os = "macos")]
    {
        use std::{ffi::CString, os::unix::ffi::OsStrExt};
        let from = CString::new(src.as_os_str().as_bytes())?;
        let cloned = tempfile::Builder::new().make_in(parent, |copy| {
            let to = CString::new(copy.as_os_str().as_bytes())?;
            // clonefile creates the destination exclusively.
            if unsafe { libc::clonefile(from.as_ptr(), to.as_ptr(), 0) } == 0 {
                Ok(())
            } else {
                Err(io::Error::last_os_error())
            }
        });
        if let Ok(stage) = cloned {
            return Ok(stage.into_temp_path());
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
    Ok(stage.into_temp_path())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn lost_selector_keeps_initial_tree_and_reclaims_alternate() {
        for startup_recovery in [false, true] {
            let root = tempfile::tempdir().unwrap();
            let store = ModStore::new(root.path());
            let stale = store.cache.join(ALTERNATE);
            fs::create_dir_all(&stale).unwrap();
            fs::write(stale.join("obsolete"), b"stale").unwrap();
            if startup_recovery {
                store.recover_once().unwrap().await.unwrap();
                assert!(!stale.exists());
                fs::create_dir(&stale).unwrap();
                assert!(store.clone().recover_once().is_none());
                assert!(stale.exists());
            }
            let tree = store.lease().await.unwrap();
            tree.prepare().await.unwrap();
            assert!(tree.root.is_dir());
            drop(tree);
            store.clear().await.unwrap();
            assert_eq!(selected_tree(&store.cache).unwrap(), Some(ALTERNATE));
            assert!(!stale.join("obsolete").exists());
        }
    }
    #[tokio::test]
    async fn clear_owns_lazy_recovery_after_selector_replacement() {
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let serial = store.clears.lock().await;
        let old = store.lease().await.unwrap();
        assert!(!store.recovery.is_completed());
        drop(serial);
        drop(old);

        let stale = store.cache.join(ALTERNATE);
        fs::create_dir(&stale).unwrap();
        fs::write(stale.join("obsolete"), b"stale").unwrap();
        store.clear().await.unwrap();
        assert!(!stale.exists());
        assert!(store.recover_once().is_none());
    }

    #[tokio::test]
    async fn reopening_store_finishes_interrupted_retirement() {
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        store.recover_once().unwrap().await.unwrap();
        store.clear().await.unwrap();
        let selected = store.lease().await.unwrap();
        selected.prepare().await.unwrap();
        fs::write(selected.root.join("verified"), b"object").unwrap();
        fs::create_dir(store.cache.join(INITIAL)).unwrap();
        fs::write(store.cache.join(INITIAL).join("obsolete"), b"old").unwrap();
        drop(store);
        let store = ModStore::new(root.path());
        store.recover_once().unwrap().await.unwrap();
        let current = store.lease().await.unwrap();
        assert_eq!(fs::read(current.root.join("verified")).unwrap(), b"object");
        assert!(!store.cache.join(INITIAL).exists());
    }

    #[tokio::test]
    async fn clear_only_removes_objects_and_waits_for_install() {
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        fs::create_dir_all(store.cache.join("objects/sha512")).unwrap();
        for file in ["index.json", "pack.mrpack", "objects/sha512/blob"] {
            fs::write(store.cache.join(file), file).unwrap();
        }
        let guard = store.lease().await.unwrap();
        let clear = store.clear();
        tokio::pin!(clear);
        assert!(futures_util::poll!(&mut clear).is_pending());
        let next = loop {
            tokio::select! {
                biased;
                _ = &mut clear => panic!("clear passed a live lease"),
                tree = store.lease() => {
                    let tree = tree.unwrap();
                    if tree.root != guard.root { break tree; }
                }
            }
            tokio::task::yield_now().await;
        };
        next.prepare().await.unwrap();
        fs::write(next.root.join("new"), "new").unwrap();
        let dst = root.path().join("materialized");
        materialize_blob(&guard.root.join("sha512/blob"), &dst).unwrap();
        assert_eq!(fs::read(dst).unwrap(), b"objects/sha512/blob");
        drop(guard);
        clear.await.unwrap();
        assert!(!store.cache.join("objects").exists());
        assert_eq!(fs::read(next.root.join("new")).unwrap(), b"new");
        for file in ["index.json", "pack.mrpack"] {
            assert_eq!(fs::read_to_string(store.cache.join(file)).unwrap(), file);
        }
    }
}
