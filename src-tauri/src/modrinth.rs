use crate::zip::{open_archive, read_limited, relative_name, Extraction};
use crate::{
    downloads::{CancelFlags, InstallDecision},
    hashing::HashAlgorithm,
    mod_store::{materialize_blob, ModStore},
};
///
/// ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning),
/// but the code here was initially written by me in TypeScript (so this is a rewrite)
///
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::path::{Path, PathBuf};
use tauri::{ipc::Channel, State};
use tokio::sync::watch;

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
    env: Option<ClientEnvironment>,
    path: String,
    #[serde(default)]
    hashes: RawHashes,
    #[serde(default)]
    downloads: Vec<String>,
    #[serde(rename = "fileSize")]
    file_size: u64,
}

#[derive(Deserialize)]
struct ClientEnvironment {
    client: Option<ClientSupport>,
}
#[derive(Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum ClientSupport {
    Required,
    Optional,
    Unsupported,
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
    #[serde(skip)]
    pub mirrors: Vec<String>,
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
    archive_path: PathBuf,
    target_dir_path: PathBuf,
    cancel_id: String,
    on_progress: Channel<(usize, usize)>,
    store: State<'_, ModStore>,
    flags: State<'_, CancelFlags>,
) -> Result<MrpackManifest, String> {
    let (mut cancel, decision) = flags.start_install(&cancel_id)?;
    let result = install(
        archive_path,
        target_dir_path,
        &store,
        decision,
        &mut cancel,
        |ok, total| {
            let _ = on_progress.send((ok, total));
        },
    )
    .await;
    flags.deregister(&cancel_id);
    check_cancel(&cancel)?;
    result
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

async fn install(
    archive_path: PathBuf,
    target: PathBuf,
    store: &ModStore,
    decision: InstallDecision,
    cancel: &mut watch::Receiver<bool>,
    progress: impl Fn(usize, usize),
) -> Result<MrpackManifest, String> {
    check_cancel(cancel)?;
    let (archive, manifest) = tokio::task::spawn_blocking(move || {
        let mut archive = open_archive(&archive_path)?;
        let manifest = read_manifest(&mut archive)?.ok_or("Missing modrinth.index.json")?;
        Ok::<_, String>((archive, manifest))
    })
    .await
    .map_err(|e| e.to_string())??;
    install_manifest(archive, manifest, target, store, decision, cancel, progress).await
}

async fn install_manifest(
    mut archive: ZipArchive<File>,
    mut manifest: MrpackManifest,
    target: PathBuf,
    store: &ModStore,
    decision: InstallDecision,
    cancel: &mut watch::Receiver<bool>,
    progress: impl Fn(usize, usize),
) -> Result<MrpackManifest, String> {
    let _guard = tokio::select! {
        guard = store.installs.read() => guard,
        _ = cancel.wait_for(|x| *x) => return Err("Installation cancelled".into()),
    };
    let mut blobs = Vec::with_capacity(manifest.files.len());
    progress(0, manifest.files.len());
    if !manifest.files.is_empty() {
        store.prepare().map_err(|e| e.to_string())?;
    }
    {
        use futures_util::{stream::FuturesUnordered, StreamExt};
        // Keep completed objects on any failure, and let already-started writes finish safely.
        const CONCURRENT_OBJECTS: usize = 8;
        let mut missing = manifest.files.iter().enumerate();
        let mut pending = FuturesUnordered::new();
        let mut error = None;
        loop {
            while pending.len() < CONCURRENT_OBJECTS && error.is_none() {
                let Some((index, file)) = missing.next() else {
                    break;
                };
                let mut cancel = cancel.clone();
                pending.push(async move {
                    store
                        .ensure(file, &mut cancel)
                        .await
                        .map(|blob| (index, blob))
                });
            }
            match pending.next().await {
                Some(Ok(blob)) => {
                    blobs.push(blob);
                    progress(blobs.len(), manifest.files.len());
                }
                Some(Err(reason)) => {
                    error.get_or_insert(reason);
                }
                None => break,
            }
        }
        if let Some(reason) = error {
            return Err(reason);
        }
    }
    let cancel = cancel.clone();
    tokio::task::spawn_blocking(move || {
        let parent = target.parent().ok_or("Missing instance parent")?;
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        if target.try_exists().map_err(|e| e.to_string())? {
            return Err("Instance already exists".into());
        }
        let stage = tempfile::tempdir_in(parent).map_err(|e| e.to_string())?;
        let mut extraction = Extraction::new(&stage.path().join("minecraft"))?;
        for (index, blob) in blobs {
            let file = &manifest.files[index];
            check_cancel(&cancel)?;
            let dest = extraction.prepare_file(&file.path)?;
            if dest.try_exists().map_err(|e| e.to_string())? {
                return Err(format!("Duplicate manifest destination: {}", file.path));
            }
            materialize_blob(&blob, &dest).map_err(|e| e.to_string())?;
        }
        let names = manifest
            .files
            .iter()
            .map(|file| file.path.clone())
            .collect();
        manifest.overrides = extract_overrides(&mut archive, &mut extraction, names, &cancel)?;
        check_cancel(&cancel)?;
        decision.publish(stage.path(), &target)?;
        Ok(manifest)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn repair_legacy_mrpack(
    archive_path: PathBuf,
    target_dir_path: PathBuf,
    store: State<'_, ModStore>,
    flags: State<'_, CancelFlags>,
    cancel_id: String,
) -> Result<(), String> {
    let mut cancel = flags.register(&cancel_id);
    let result = repair(archive_path, target_dir_path, &store, &mut cancel).await;
    flags.deregister(&cancel_id);
    result
}

async fn repair(
    archive: PathBuf,
    root: PathBuf,
    store: &ModStore,
    cancel: &mut watch::Receiver<bool>,
) -> Result<(), String> {
    let manifest = tokio::task::spawn_blocking(move || peek(&archive))
        .await
        .map_err(|e| e.to_string())??
        .ok_or("Missing modrinth.index.json")?;
    let _guard = store.installs.read().await;
    let mut extraction = Extraction::new(&root)?;
    for file in &manifest.files {
        check_cancel(cancel)?;
        let dest = extraction.prepare_file(&file.path)?;
        match dest.symlink_metadata() {
            Ok(meta) if meta.is_file() => continue,
            Ok(_) => return Err(format!("Unexpected legacy destination: {}", dest.display())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(e.to_string()),
        }
        if file.path.starts_with("mods/")
            && file.path.ends_with(".jar")
            && dest
                .with_extension("jar.disabled")
                .try_exists()
                .map_err(|e| e.to_string())?
        {
            continue;
        }
        store.prepare().map_err(|e| e.to_string())?;
        let blob = store.ensure(file, cancel).await?;
        tokio::task::spawn_blocking(move || match materialize_blob(&blob, &dest) {
            Err(e)
                if e.kind() == std::io::ErrorKind::AlreadyExists
                    && dest.symlink_metadata()?.is_file() =>
            {
                Ok(())
            }
            result => result,
        })
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn check_cancel(cancel: &watch::Receiver<bool>) -> Result<(), String> {
    if *cancel.borrow() {
        Err("Installation cancelled".into())
    } else {
        Ok(())
    }
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
    let support = raw.env.and_then(|env| env.client);
    if support == Some(ClientSupport::Unsupported) {
        return Ok(None);
    }
    if raw.path.ends_with('/') {
        return Err(format!("Expected manifest file: {}", raw.path));
    }
    relative_name(&raw.path)?;
    let mut urls = raw.downloads.into_iter().filter(|url| {
        reqwest::Url::parse(url).is_ok_and(|u| u.scheme() == "https" && u.host_str().is_some())
    });
    let Some(url) = urls.next() else {
        return if support == Some(ClientSupport::Optional) {
            Ok(None)
        } else {
            Err(format!("No HTTPS download for {}", raw.path))
        };
    };
    HashAlgorithm::Sha1.validate(&raw.hashes.sha1)?;
    HashAlgorithm::Sha512.validate(&raw.hashes.sha512)?;

    let mirrors: Vec<_> = urls.collect();
    Ok(Some(ManifestFile {
        external: !url.starts_with(TRUSTED_PREFIX)
            || mirrors.iter().any(|u| !u.starts_with(TRUSTED_PREFIX)),
        mirrors,
        path: raw.path,
        url,
        file_size: raw.file_size,
        sha1: raw.hashes.sha1.to_ascii_lowercase(),
        sha512: raw.hashes.sha512.to_ascii_lowercase(),
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
    extraction: &mut Extraction,
    mut names: HashSet<String>,
    cancel: &watch::Receiver<bool>,
) -> Result<usize, String> {
    let mut written = 0;

    for layer in OVERRIDE_PREFIXES {
        for index in 0..archive.len() {
            check_cancel(cancel)?;
            let Some((prefix, relative)) = archive
                .name_for_index(index)
                .and_then(|name| name.split_once('/'))
            else {
                continue;
            };
            if prefix != layer || relative.is_empty() {
                continue;
            }
            let name = relative.to_owned();
            let entry = archive.by_index(index).map_err(|e| e.to_string())?;
            if entry.is_symlink() {
                return Err(format!("Symlink override: {}", entry.name()));
            }
            let directory = entry.is_dir();
            if !directory && !names.contains(&name) {
                let path = extraction.prepare_file(&name)?;
                if path.try_exists().map_err(|e| e.to_string())? {
                    return Err(format!("Aliased override destination: {name}"));
                }
                names.insert(name.clone());
            }
            extraction.extract(&name, directory, None, entry)?;
            written += usize::from(!directory);
        }
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
    fn archive(entries: &[(&str, &str)]) -> ZipArchive<File> {
        let mut file = tempfile::tempfile().unwrap();
        let mut zip = zip::ZipWriter::new(&mut file);
        for (name, text) in entries {
            zip.start_file(*name, zip::write::SimpleFileOptions::default())
                .unwrap();
            zip.write_all(text.as_bytes()).unwrap();
        }
        zip.finish().unwrap();
        ZipArchive::new(file).unwrap()
    }

    #[tokio::test]
    async fn cancel_preserves_verified_objects_and_retry_is_independent() {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let addr = listener.local_addr().unwrap();
        let (requested, mut requests) = tokio::sync::mpsc::unbounded_channel();
        let server = tokio::spawn(async move {
            loop {
                let (socket, _) = listener.accept().await.unwrap();
                let requested = requested.clone();
                tokio::spawn(async move {
                    let mut reader = tokio::io::BufReader::new(socket);
                    let mut line = String::new();
                    reader.read_line(&mut line).await.unwrap();
                    let route = line.split_whitespace().nth(1).unwrap();
                    requested.send(route.to_owned()).unwrap();
                    if route == "/stall" {
                        let mut sink = Vec::new();
                        tokio::io::AsyncReadExt::read_to_end(&mut reader, &mut sink)
                            .await
                            .unwrap();
                    } else {
                        let body = if route == "/one" { "one" } else { "two" };
                        reader.into_inner().write_all(format!("HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\n{body}").as_bytes()).await.unwrap();
                    }
                });
            }
        });
        let file = |name: &str, route: &str| ManifestFile {
            path: format!("mods/{name}.jar"),
            url: format!("http://{addr}/{route}"),
            external: false,
            mirrors: Vec::new(),
            file_size: 3,
            sha512: crate::hashing::hash_bytes::<sha2::Sha512>(name.as_bytes()),
            sha1: crate::hashing::hash_bytes::<sha1::Sha1>(name.as_bytes()),
        };
        let manifest = |second| MrpackManifest {
            files: vec![file("one", "one"), file("two", second)],
            format_version: 1,
            name: "test".into(),
            version_id: "1".into(),
            dependencies: HashMap::new(),
            summary: None,
            overrides: 0,
        };
        let (stop, mut cancel) = watch::channel(false);
        let failed = root.path().join("failed");
        let result = install_manifest(
            archive(&[]),
            manifest("stall"),
            failed.clone(),
            &store,
            InstallDecision::default(),
            &mut cancel,
            |count, _| {
                if count == 1 {
                    stop.send_replace(true);
                }
            },
        )
        .await;
        assert!(matches!(result,Err(reason) if reason.contains("cancelled")));
        assert!(!failed.exists());
        let hash = file("one", "one").sha512;
        let blob = root
            .path()
            .join("cache/objects/sha512")
            .join(&hash[..2])
            .join(hash);
        assert_eq!(std::fs::read(&blob).unwrap(), b"one");
        let layers = [
            ("client-overrides/options.txt", "client"),
            ("overrides/options.txt", "common"),
        ];
        stop.send_replace(false);
        for (id, entries) in [("a", layers), ("b", [layers[1], layers[0]])] {
            let target = root.path().join(id);
            install_manifest(
                archive(&entries),
                manifest("two"),
                target.clone(),
                &store,
                InstallDecision::default(),
                &mut cancel,
                |_, _| {},
            )
            .await
            .unwrap();
            assert_eq!(
                std::fs::read(target.join("minecraft/options.txt")).unwrap(),
                b"client"
            );
        }
        std::fs::OpenOptions::new()
            .write(true)
            .open(root.path().join("a/minecraft/mods/one.jar"))
            .unwrap()
            .write_all(b"X")
            .unwrap();
        assert_eq!(std::fs::read(&blob).unwrap(), b"one");
        assert_eq!(
            std::fs::read(root.path().join("b/minecraft/mods/one.jar")).unwrap(),
            b"one"
        );
        server.abort();
        let mut routes = Vec::new();
        while let Ok(route) = requests.try_recv() {
            routes.push(route);
        }
        assert_eq!(routes.iter().filter(|r| *r == "/one").count(), 1);
        assert_eq!(routes.iter().filter(|r| *r == "/two").count(), 1);
    }

    #[test]
    fn validate_client_manifest() {
        let raw = serde_json::json!({
            "path":"safe.jar","hashes":{"sha512":"A".repeat(128),"sha1":"B".repeat(40)},
            "fileSize":0,"downloads":["https://example.org","http://unsafe.invalid","https://mirror.invalid"]
        });
        let map = |value| map_file(serde_json::from_value(value).unwrap());
        let file = map(raw.clone()).unwrap().unwrap();
        assert_eq!(file.sha1, "b".repeat(40));
        assert_eq!(file.mirrors, vec!["https://mirror.invalid"]);
        for (field, value) in [
            ("downloads", serde_json::json!(["http://example.org"])),
            ("path", serde_json::json!("../bad")),
            (
                "hashes",
                serde_json::json!({"sha1":"z".repeat(40),"sha512":"0".repeat(128)}),
            ),
        ] {
            let mut invalid = raw.clone();
            invalid[field] = value;
            assert!(map(invalid).is_err());
        }
        let mut server = raw;
        server["env"] = serde_json::json!({"client":"unsupported"});
        server["downloads"] = serde_json::json!([]);
        assert!(map(server).unwrap().is_none());
    }

    #[tokio::test]
    async fn unsafe_override_never_exposes_instance() {
        for symlink in [true, false] {
            let root = tempfile::tempdir().unwrap();
            let pack = root.path().join("pack.zip");
            let mut zip = zip::ZipWriter::new(File::create(&pack).unwrap());
            let options = zip::write::SimpleFileOptions::default();
            zip.start_file(MANIFEST_ENTRY, options).unwrap();
            zip.write_all(b"{}").unwrap();
            if symlink {
                zip.add_symlink("overrides/link", "../outside", options)
                    .unwrap();
            } else {
                zip.start_file("overrides/../../outside", options).unwrap();
            }
            zip.finish().unwrap();
            let store = ModStore::new(root.path());
            let (_send, mut cancel) = watch::channel(false);
            let target = root.path().join("instances/id");
            assert!(install(
                pack,
                target.clone(),
                &store,
                InstallDecision::default(),
                &mut cancel,
                |_, _| {}
            )
            .await
            .is_err());
            assert!(!target.exists());
            assert_eq!(target.parent().unwrap().read_dir().unwrap().count(), 0);
        }
    }

    fn seed_blob(store_root: &Path, bytes: &[u8]) -> (ManifestFile, PathBuf) {
        let sha512 = crate::hashing::hash_bytes::<sha2::Sha512>(bytes);
        let path = store_root
            .join("cache/objects/sha512")
            .join(&sha512[..2])
            .join(&sha512);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, bytes).unwrap();
        (
            ManifestFile {
                path: "mods/item.jar".into(),
                url: "https://example.invalid/item".into(),
                mirrors: Vec::new(),
                external: true,
                file_size: bytes.len() as u64,
                sha512,
                sha1: crate::hashing::hash_bytes::<sha1::Sha1>(bytes),
            },
            path,
        )
    }

    #[tokio::test]
    async fn installs_reject_contradictions_and_evict_same_size_corruption() {
        use tokio::io::AsyncWriteExt;
        for corrupt in [false, true] {
            let root = tempfile::tempdir().unwrap();
            let store = ModStore::new(root.path());
            let (mut file, path) = seed_blob(root.path(), b"good");
            let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
                .await
                .unwrap();
            file.url = format!("http://{}", listener.local_addr().unwrap());
            if corrupt {
                std::fs::write(&path, b"evil").unwrap();
            } else {
                file.sha1 = "0".repeat(40);
            }
            let mut manifest = build_manifest(serde_json::from_str("{}").unwrap()).unwrap();
            manifest.files.push(file);
            let (_stop, mut cancel) = watch::channel(false);
            let target = root.path().join("instance");
            let attempt = install_manifest(
                archive(&[]),
                manifest,
                target.clone(),
                &store,
                InstallDecision::default(),
                &mut cancel,
                |_, _| {},
            );
            if corrupt {
                let (result, ()) = tokio::join!(attempt, async {
                    let (mut socket, _) = listener.accept().await.unwrap();
                    socket
                        .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nevil")
                        .await
                        .unwrap();
                });
                assert!(matches!(result,Err(e) if e.contains("Hash mismatch")));
                assert!(!path.exists());
            } else {
                assert!(matches!(attempt.await,Err(e) if e.contains("Contradictory")));
                assert_eq!(std::fs::read(path).unwrap(), b"good");
            }
            assert!(!target.exists());
        }
    }

    #[tokio::test]
    async fn fallback_mirror_admits_verified_bytes_after_404() {
        use tokio::io::AsyncWriteExt;
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let (mut file, path) = seed_blob(root.path(), b"good");
        std::fs::remove_file(&path).unwrap();
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        file.url = format!("{url}/first");
        file.mirrors = vec![format!("{url}/second")];
        let (_stop, mut cancel) = watch::channel(false);
        let (result, ()) = tokio::join!(store.ensure(&file, &mut cancel), async {
            for response in [
                b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n".as_slice(),
                b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\ngood",
            ] {
                let (mut socket, _) = listener.accept().await.unwrap();
                socket.write_all(response).await.unwrap();
            }
        });
        assert_eq!(result.unwrap(), path);
        assert_eq!(std::fs::read(path).unwrap(), b"good");
    }

    #[tokio::test]
    async fn legacy_repair_only_restores_missing_indexed_files() {
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let (file, _) = seed_blob(root.path(), b"good");
        let indexed = serde_json::json!({"path":file.path,"hashes":{"sha1":file.sha1,"sha512":file.sha512},"downloads":[file.url],"fileSize":file.file_size});
        let mut existing = indexed.clone();
        existing["path"] = "options.txt".into();
        let mut disabled = indexed.clone();
        disabled["path"] = "mods/disabled.jar".into();
        let index = serde_json::json!({"files":[indexed,existing,disabled]}).to_string();
        let mut zip = archive(&[
            (MANIFEST_ENTRY, &index),
            ("overrides/options.txt", "default"),
            ("client-overrides/new.cfg", "new"),
        ])
        .into_inner();
        use std::io::Seek;
        zip.rewind().unwrap();
        let pack = root.path().join("legacy.mrpack");
        std::io::copy(&mut zip, &mut File::create(&pack).unwrap()).unwrap();
        let minecraft = root.path().join("instance/minecraft");
        std::fs::create_dir_all(minecraft.join("mods")).unwrap();
        std::fs::write(minecraft.join("mods/disabled.jar.disabled"), "edited").unwrap();
        std::fs::write(minecraft.join("options.txt"), "edited").unwrap();
        let (_stop, mut cancel) = watch::channel(false);
        repair(pack, minecraft.clone(), &store, &mut cancel)
            .await
            .unwrap();
        assert_eq!(
            std::fs::read(minecraft.join("mods/item.jar")).unwrap(),
            b"good"
        );
        assert_eq!(
            std::fs::read(minecraft.join("options.txt")).unwrap(),
            b"edited"
        );
        assert!(!minecraft.join("new.cfg").exists());
        assert!(!minecraft.join("mods/disabled.jar").exists());
    }
}
