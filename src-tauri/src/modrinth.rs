use crate::zip::{open_archive, read_limited, relative_name, Extraction};
use crate::{
    downloads::CancelFlags,
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
    checksum: bool,
    cancel_id: String,
    on_progress: Channel<(usize, usize)>,
    store: State<'_, ModStore>,
    flags: State<'_, CancelFlags>,
) -> Result<MrpackManifest, String> {
    let mut cancel = flags.register(&cancel_id);
    let result = install(
        archive_path,
        target_dir_path,
        &store,
        checksum,
        &mut cancel,
        |ok, total| {
            let _ = on_progress.send((ok, total));
        },
    )
    .await;
    flags.deregister(&cancel_id);
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
    checksum: bool,
    cancel: &mut watch::Receiver<bool>,
    progress: impl Fn(usize, usize),
) -> Result<MrpackManifest, String> {
    let (archive, manifest) = tokio::task::spawn_blocking(move || {
        let mut archive = open_archive(&archive_path)?;
        let manifest = read_manifest(&mut archive)?.ok_or("Missing modrinth.index.json")?;
        Ok::<_, String>((archive, manifest))
    })
    .await
    .map_err(|e| e.to_string())??;
    install_manifest(archive, manifest, target, store, checksum, cancel, progress).await
}

async fn install_manifest(
    mut archive: ZipArchive<File>,
    mut manifest: MrpackManifest,
    target: PathBuf,
    store: &ModStore,
    checksum: bool,
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
                        .ensure(file, checksum, &mut cancel)
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
        std::fs::rename(stage.path(), target).map_err(|e| e.to_string())?;
        Ok(manifest)
    })
    .await
    .map_err(|e| e.to_string())?
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
    let Some(url) = raw.downloads.into_iter().find(|url| {
        reqwest::Url::parse(url).is_ok_and(|u| u.scheme() == "https" && u.host_str().is_some())
    }) else {
        return if support == Some(ClientSupport::Optional) {
            Ok(None)
        } else {
            Err(format!("No HTTPS download for {}", raw.path))
        };
    };
    HashAlgorithm::Sha1.validate(&raw.hashes.sha1)?;
    HashAlgorithm::Sha512.validate(&raw.hashes.sha512)?;

    Ok(Some(ManifestFile {
        external: !url.starts_with(TRUSTED_PREFIX),
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
            false,
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
                true,
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
            "fileSize":0,"downloads":["https://example.org"]
        });
        let map = |value| map_file(serde_json::from_value(value).unwrap());
        assert_eq!(map(raw.clone()).unwrap().unwrap().sha1, "b".repeat(40));
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
            assert!(
                install(pack, target.clone(), &store, false, &mut cancel, |_, _| {})
                    .await
                    .is_err()
            );
            assert!(!target.exists());
            assert_eq!(target.parent().unwrap().read_dir().unwrap().count(), 0);
        }
    }
}
