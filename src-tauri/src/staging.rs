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
    pub(crate) fn pin(&self, path: &Path) -> Option<Pin> {
        if !self.owns(path) {
            return None;
        }
        *self
            .pins
            .lock()
            .unwrap()
            .entry(path.to_owned())
            .or_default() += 1;
        Some(Pin {
            staging: self.clone(),
            path: path.to_owned(),
            collect_on_drop: false,
        })
    }
    pub(crate) fn pin_install(&self, path: &Path) -> Option<Pin> {
        let mut pin = self.pin(path)?;
        pin.collect_on_drop = true;
        Some(pin)
    }
    fn cleanup(&self, only: Option<PathBuf>, protected: Vec<PathBuf>) -> io::Result<()> {
        let cache = self.base.join("cache");
        let staging = cache.join("mrpack-staging");
        for directory in [&cache, &staging] {
            match fs::symlink_metadata(directory) {
                Ok(meta) if crate::mod_store::ordinary_directory(&meta) => (),
                Ok(_) => return Err(io::Error::other("Invalid staging directory")),
                Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
                Err(e) => return Err(e),
            }
        }
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
            match fs::symlink_metadata(&path) {
                Ok(meta) if meta.is_file() && !crate::mod_store::is_reparse_point(&meta) => {
                    if !targets.contains(&path.canonicalize()?) {
                        fs::remove_file(path)?;
                    }
                }
                Ok(_) => (),
                Err(e) if e.kind() == io::ErrorKind::NotFound => (),
                Err(e) => return Err(e),
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
) -> Option<u32> {
    use tauri::Manager;
    staging
        .pin(&path)
        .map(|pin| webview.resources_table().add(pin))
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
