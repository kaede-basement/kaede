use std::{
    collections::{HashMap, HashSet},
    fs, io,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

#[derive(Clone)]
pub(crate) struct Staging {
    base: PathBuf,
    pins: Arc<Mutex<HashMap<PathBuf, usize>>>,
}

pub(crate) struct Pin {
    staging: Staging,
    pub(crate) path: PathBuf,
    collect_on_drop: bool,
}
impl tauri::Resource for Pin {}
impl Drop for Pin {
    fn drop(&mut self) {
        let mut pins = self.staging.pins.lock().unwrap();
        let count = pins.get_mut(&self.path).unwrap();
        *count -= 1;
        if *count == 0 {
            pins.remove(&self.path);
            if self.collect_on_drop {
                let path = self.path.clone();
                let staging = self.staging.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    if let Err(error) = staging.cleanup(Some(path), Vec::new()) {
                        log::warn!("Cannot release staged install: {error}");
                    }
                });
            }
        }
    }
}

impl Staging {
    pub(crate) fn new(base: &Path) -> Self {
        Self {
            base: base.to_owned(),
            pins: Arc::default(),
        }
    }
    fn owns(&self, path: &Path) -> bool {
        path.parent() == Some(self.base.join("cache/mrpack-staging").as_path())
            && path
                .file_name()
                .and_then(|s| s.to_str())
                .is_some_and(|s| s.starts_with("modrinth-") && s.ends_with(".mrpack"))
    }
    fn directory(&self) -> io::Result<Option<PathBuf>> {
        let cache = self.base.join("cache");
        let staging = cache.join("mrpack-staging");
        for directory in [&cache, &staging] {
            match fs::symlink_metadata(directory) {
                Ok(meta) if crate::mod_store::ordinary_directory(&meta) => (),
                Ok(_) => return Err(io::Error::other("Invalid staging directory")),
                Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
                Err(e) => return Err(e),
            }
        }
        Ok(Some(staging))
    }
    pub(crate) fn pin(&self, path: &Path) -> io::Result<Option<Pin>> {
        if !self.owns(path) {
            return Ok(None);
        }
        self.directory()?;
        *self
            .pins
            .lock()
            .unwrap()
            .entry(path.to_owned())
            .or_default() += 1;
        Ok(Some(Pin {
            staging: self.clone(),
            path: path.to_owned(),
            collect_on_drop: false,
        }))
    }
    pub(crate) fn pin_install(&self, path: &Path) -> io::Result<Option<Pin>> {
        let Some(mut pin) = self.pin(path)? else {
            return Ok(None);
        };
        pin.collect_on_drop = true;
        Ok(Some(pin))
    }
    fn cleanup(&self, only: Option<PathBuf>, protected: Vec<PathBuf>) -> io::Result<()> {
        let Some(staging) = self.directory()? else {
            return Ok(());
        };
        let mut paths = Vec::new();
        if let Some(path) = only {
            if self.owns(&path) && !self.pins.lock().unwrap().contains_key(&path) {
                paths.push(path);
            }
        } else {
            for entry in fs::read_dir(staging)? {
                let path = entry?.path();
                if self.owns(&path) {
                    paths.push(path);
                }
            }
        }
        if paths.is_empty() {
            return Ok(());
        }
        let mut protected: HashSet<_> = protected.into_iter().collect();
        match fs::read(self.base.join("instances.json")) {
            Ok(bytes) => {
                let instances: HashMap<String, serde_json::Value> =
                    serde_json::from_slice(bytes.strip_prefix(b"\xef\xbb\xbf").unwrap_or(&bytes))?;
                protected.extend(
                    instances
                        .values()
                        .filter_map(|i| i.get("modpackPath")?.as_str().map(PathBuf::from)),
                );
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => (),
            Err(e) => return Err(e),
        }
        let mut targets = HashSet::new();
        for path in &protected {
            match path.canonicalize() {
                Ok(target) => {
                    targets.insert(target);
                }
                Err(e) if e.kind() == io::ErrorKind::NotFound => (),
                Err(e) => return Err(e),
            }
        }
        for path in paths {
            if !self.owns(&path) || protected.contains(&path) {
                continue;
            }
            let pins = self.pins.lock().unwrap();
            if pins.contains_key(&path) {
                continue;
            }
            let remove_unused = || -> io::Result<()> {
                let meta = fs::symlink_metadata(&path)?;
                if meta.is_file()
                    && !crate::mod_store::is_reparse_point(&meta)
                    && !targets.contains(&path.canonicalize()?)
                {
                    fs::remove_file(&path)?;
                }
                Ok(())
            };
            if let Err(e) = remove_unused() {
                if e.kind() != io::ErrorKind::NotFound {
                    log::warn!("Cannot collect {}: {e}", path.display());
                }
            }
        }
        Ok(())
    }
    pub(crate) async fn collect(
        self,
        only: Option<PathBuf>,
        protected: Vec<PathBuf>,
    ) -> Result<(), String> {
        tokio::task::spawn_blocking(move || self.cleanup(only, protected))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub(crate) fn pin_stage(
    webview: tauri::Webview,
    staging: tauri::State<Staging>,
    path: PathBuf,
) -> Result<Option<u32>, String> {
    use tauri::Manager;
    staging
        .pin(&path)
        .map(|pin| pin.map(|pin| webview.resources_table().add(pin)))
        .map_err(|e| e.to_string())
}

pub(crate) fn release_page(table: &mut tauri::ResourceTable) {
    let ids: Vec<_> = table
        .names()
        .filter(|(_, name)| *name == std::any::type_name::<Pin>())
        .map(|(id, _)| id)
        .collect();
    for id in ids {
        drop(table.take::<Pin>(id));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    #[test]
    fn admission_and_collection_reject_a_linked_staging_directory() {
        let dir = tempfile::tempdir().unwrap();
        let cache = dir.path().join("cache");
        fs::create_dir(&cache).unwrap();
        let staging = cache.join("mrpack-staging");
        std::os::unix::fs::symlink(dir.path(), &staging).unwrap();
        let store = Staging::new(dir.path());
        assert!(store.pin(&staging.join("modrinth-link.mrpack")).is_err());
        assert!(store.cleanup(None, vec![]).is_err());
    }
    #[cfg(windows)]
    #[test]
    fn locked_orphan_does_not_block_other_archives() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let folder = dir.path().join("cache/mrpack-staging");
        fs::create_dir_all(&folder).unwrap();
        let locked = folder.join("modrinth-a.mrpack");
        let other = folder.join("modrinth-b.mrpack");
        fs::write(&locked, []).unwrap();
        fs::write(&other, []).unwrap();
        let _reader = fs::File::options()
            .read(true)
            .share_mode(1)
            .open(&locked)
            .unwrap();
        Staging::new(dir.path()).cleanup(None, vec![]).unwrap();
        assert!(locked.exists() && !other.exists());
    }
    #[test]
    fn collection_respects_live_pins_legacy_instances_and_external_files() {
        let dir = tempfile::tempdir().unwrap();
        let store = Staging::new(dir.path());
        let cache = dir.path().join("cache");
        let staging = cache.join("mrpack-staging");
        fs::create_dir_all(&staging).unwrap();
        let paths = ["draft", "install", "legacy", "orphan"]
            .map(|s| staging.join(format!("modrinth-{s}.mrpack")));
        for path in &paths {
            fs::write(path, b"pack").unwrap();
        }
        let local = cache.join("modrinth-local.mrpack");
        fs::write(&local, b"local").unwrap();
        fs::write(
            dir.path().join("instances.json"),
            serde_json::json!({"game":{"modpackPath":paths[2]}}).to_string(),
        )
        .unwrap();
        let pins = [store.pin(&paths[0]), store.pin(&paths[1])];
        store.cleanup(None, vec![]).unwrap();
        assert_eq!(
            paths.each_ref().map(|p| p.exists()),
            [true, true, true, false]
        );
        drop(pins);
        store.cleanup(Some(paths[0].clone()), vec![]).unwrap();
        store.cleanup(Some(local.clone()), vec![]).unwrap();
        assert!(!paths[0].exists() && local.exists());
    }
}
