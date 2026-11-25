use crate::zip::{open_archive, read_limited, relative_name, Extraction};
use crate::{
    downloads::{CancelFlags, CancelSignal, DownloadError, InstallDecision},
    hashing::HashAlgorithm,
    mod_store::{materialize_blob, stage_blob, ModStore},
};
///
/// ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning),
/// but the code here was initially written by me in TypeScript (so this is a rewrite)
///
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::path::{Path, PathBuf};
use tauri::{ipc::Channel, Manager, State};
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

#[derive(Clone, Serialize)]
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

pub(crate) fn install_mrpack(
    invoke: &crate::Invoke,
) -> Result<
    impl std::future::Future<Output = Result<MrpackManifest, String>>,
    tauri::ipc::InvokeError,
> {
    const NAME: &str = "install_mrpack";
    let archive = crate::argument(invoke, NAME, "archivePath")?;
    let target = crate::argument(invoke, NAME, "targetDirPath")?;
    let id: String = crate::argument(invoke, NAME, "cancelId")?;
    let reservation = crate::argument(invoke, NAME, "reservation")?;
    let progress: Channel<(usize, usize)> = crate::argument(invoke, NAME, "onProgress")?;
    let webview = invoke.message.webview_ref();
    let store = crate::argument::<State<ModStore>>(invoke, NAME, "store")?
        .inner()
        .clone();
    let flags: State<CancelFlags> = crate::argument(invoke, NAME, "flags")?;
    let (mut cancel, decision) =
        flags.bind_install(&id, reservation, &webview.resources_table())?;
    Ok(async move {
        install(
            archive,
            target,
            &store,
            decision,
            &mut cancel,
            |ok, total| {
                let _ = progress.send((ok, total));
            },
        )
        .await
    })
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
    cancel: &mut CancelSignal,
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
    cancel: &mut CancelSignal,
    progress: impl Fn(usize, usize),
) -> Result<MrpackManifest, String> {
    let mut blobs = Vec::with_capacity(manifest.files.len());
    progress(0, manifest.files.len());
    let lease = if manifest.files.is_empty() {
        None
    } else {
        let store = store.lease().await?;
        store.prepare().await?;
        use futures_util::{stream::FuturesUnordered, StreamExt};
        // Keep completed objects on any failure, and let already-started writes finish safely.
        const CONCURRENT_OBJECTS: usize = 8;
        let mut missing = manifest.files.iter().enumerate();
        let mut pending = FuturesUnordered::new();
        let mut error = None;
        let (stop, local) = watch::channel(*cancel.borrow());
        loop {
            while pending.len() < CONCURRENT_OBJECTS && error.is_none() {
                let Some((index, file)) = missing.next() else {
                    break;
                };
                let user = cancel.clone();
                let local = local.clone();
                let store = store.clone();
                pending.push(async move {
                    store
                        .ensure(file, &user, Some(&local))
                        .await
                        .map(|blob| (index, blob))
                });
            }
            let next = tokio::select! {
                biased;
                next = pending.next() => next,
                _ = cancel.wait_for(|x| *x), if error.is_none() => {
                    stop.send_replace(true);
                    error = Some(DownloadError::Cancelled);
                    continue;
                }
            };
            match next {
                Some(Ok(blob)) => {
                    blobs.push(blob);
                    progress(blobs.len(), manifest.files.len());
                }
                Some(Err(reason)) => {
                    stop.send_replace(true);
                    if error
                        .as_ref()
                        .map_or(true, |previous| reason.priority() > previous.priority())
                    {
                        error = Some(reason);
                    }
                }
                None => break,
            }
        }
        if let Some(reason) = error {
            return Err(reason.install_message());
        }
        Some(store)
    };
    let cancel = cancel.clone();
    tokio::task::spawn_blocking(move || {
        let _lease = lease;
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

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RepairOutcome {
    Repaired,
    ArchiveUnavailable,
}

#[tauri::command]
pub async fn repair_legacy_mrpack(
    archive_path: PathBuf,
    target_dir_path: PathBuf,
    store: State<'_, ModStore>,
    flags: State<'_, CancelFlags>,
    cancel_id: String,
    on_progress: Channel<(usize, usize)>,
) -> Result<RepairOutcome, String> {
    let mut cancel = flags.register(&cancel_id);
    let result = repair(
        archive_path,
        target_dir_path,
        &store,
        &mut cancel,
        move |done, total| {
            let _ = on_progress.send((done, total));
        },
    )
    .await?;
    check_cancel(&cancel)?;
    Ok(result)
}

fn missing_destination(extraction: &mut Extraction, name: &str) -> Result<Option<PathBuf>, String> {
    let dest = extraction.prepare_file(name)?;
    match dest.symlink_metadata() {
        Ok(meta) if meta.is_file() => return Ok(None),
        Ok(_) => return Err(format!("Unexpected legacy destination: {}", dest.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
        Err(e) => return Err(e.to_string()),
    }
    if name
        .split('/')
        .next()
        .is_some_and(|part| part.eq_ignore_ascii_case("mods"))
        && name.ends_with(".jar")
        && dest
            .with_extension("jar.disabled")
            .try_exists()
            .map_err(|e| e.to_string())?
    {
        return Ok(None);
    }
    Ok(Some(dest))
}

fn accept_existing(result: std::io::Result<()>, dest: &Path) -> std::io::Result<()> {
    match result {
        Err(e)
            if e.kind() == std::io::ErrorKind::AlreadyExists
                && dest.symlink_metadata()?.is_file() =>
        {
            Ok(())
        }
        result => result,
    }
}

fn stage_override(
    mut entry: impl std::io::Read,
    dest: &Path,
    cancel: &watch::Receiver<bool>,
) -> Result<tempfile::TempPath, String> {
    use std::io::Write;
    let mut stage =
        crate::file_system::staging_file(dest.parent().unwrap()).map_err(|e| e.to_string())?;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        check_cancel(cancel)?;
        let bytes = entry.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes == 0 {
            break;
        }
        stage
            .write_all(&buffer[..bytes])
            .map_err(|e| e.to_string())?;
    }
    Ok(stage.into_temp_path())
}

fn publish_repair(
    stage: tempfile::TempPath,
    dest: &Path,
    cancel: &CancelSignal,
) -> Result<(), String> {
    let _permit = cancel
        .publication_permit()
        .map_err(DownloadError::install_message)?;
    accept_existing(
        crate::file_system::persist_temp_path(stage, dest, false).map_err(|e| e.error),
        dest,
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

async fn repair(
    archive_path: PathBuf,
    root: PathBuf,
    store: &ModStore,
    cancel: &mut CancelSignal,
    progress: impl Fn(usize, usize) + Send + Clone + 'static,
) -> Result<RepairOutcome, String> {
    progress(0, 1);
    let stop = cancel.clone();
    let report = progress.clone();
    let prepared = tokio::task::spawn_blocking(move || -> Result<_, String> {
        check_cancel(&stop)?;
        let opened = archive_path.metadata().and_then(|metadata| {
            if metadata.is_file() {
                File::open(&archive_path)
            } else {
                Err(std::io::Error::other("Not a regular file"))
            }
        });
        let file = match opened {
            Ok(file) => file,
            Err(error) => {
                log::warn!(
                    "Cannot open legacy archive {}: {error}. Launching installed files.",
                    archive_path.display()
                );
                return Ok(None);
            }
        };
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
        let manifest = read_manifest(&mut archive)?.ok_or("Missing modrinth.index.json")?;
        let entries = override_entries(&archive);
        let overrides = entries.len();
        let total = overrides + manifest.files.len();
        report(0, total);
        let mut extraction = Extraction::new(&root)?;
        // Publish missing client overrides first so lower-priority sources see an existing file.
        for (done, (index, name)) in entries.into_iter().rev().enumerate() {
            check_cancel(&stop)?;
            let entry = archive.by_index(index).map_err(|e| e.to_string())?;
            validate_override(&entry, &name)?;
            if entry.is_dir() {
                extraction.extract(&name, true, None, std::io::empty())?;
            } else if let Some(dest) = missing_destination(&mut extraction, &name)? {
                publish_repair(stage_override(entry, &dest, &stop)?, &dest, &stop)?;
            }
            report(done + 1, total);
        }
        Ok(Some((manifest, extraction, overrides, total)))
    })
    .await
    .map_err(|e| e.to_string())??;
    let Some((manifest, mut extraction, overrides, total)) = prepared else {
        return Ok(RepairOutcome::ArchiveUnavailable);
    };
    let mut objects = None;
    for (index, file) in manifest.files.iter().enumerate() {
        check_cancel(cancel)?;
        let name = file.path.clone();
        let (next, dest) = tokio::task::spawn_blocking(move || {
            let dest = missing_destination(&mut extraction, &name);
            (extraction, dest)
        })
        .await
        .map_err(|e| e.to_string())?;
        extraction = next;
        if let Some(dest) = dest? {
            let store = match &mut objects {
                Some(tree) => tree,
                None => {
                    let tree = store.lease().await?;
                    tree.prepare().await?;
                    objects.insert(tree)
                }
            };
            let blob = store
                .ensure(file, cancel, None)
                .await
                .map_err(DownloadError::install_message)?;
            check_cancel(cancel)?;
            let lease = store.clone();
            let stop = cancel.clone();
            tokio::task::spawn_blocking(move || {
                let _lease = lease;
                let stage = stage_blob(&blob, &dest).map_err(|e| e.to_string())?;
                publish_repair(stage, &dest, &stop)
            })
            .await
            .map_err(|e| e.to_string())??;
        }
        progress(overrides + index + 1, total);
    }
    check_cancel(cancel)?;
    Ok(RepairOutcome::Repaired)
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

fn override_entries(archive: &ZipArchive<File>) -> Vec<(usize, String)> {
    let mut entries = Vec::new();
    for layer in OVERRIDE_PREFIXES {
        for index in 0..archive.len() {
            if let Some((prefix, name)) = archive
                .name_for_index(index)
                .and_then(|name| name.split_once('/'))
            {
                if prefix == layer && !name.is_empty() {
                    entries.push((index, name.to_owned()));
                }
            }
        }
    }
    entries
}

fn validate_override(entry: &zip::read::ZipFile<'_, File>, name: &str) -> Result<(), String> {
    relative_name(name)?;
    if entry.is_symlink() {
        return Err(format!("Symlink override: {}", entry.name()));
    }
    Ok(())
}

fn extract_overrides(
    archive: &mut ZipArchive<File>,
    extraction: &mut Extraction,
    mut names: HashSet<String>,
    cancel: &watch::Receiver<bool>,
) -> Result<usize, String> {
    let mut written = 0;

    for (index, name) in override_entries(archive) {
        check_cancel(cancel)?;
        let entry = archive.by_index(index).map_err(|e| e.to_string())?;
        validate_override(&entry, &name)?;
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
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::downloads::mock_http::{accept_request, respond};
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
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let addr = listener.local_addr().unwrap();
        let (requested, mut requests) = tokio::sync::mpsc::unbounded_channel();
        let server = tokio::spawn(async move {
            loop {
                let (mut socket, request_line) = accept_request(&listener).await;
                let requested = requested.clone();
                tokio::spawn(async move {
                    let route = request_line.split_whitespace().nth(1).unwrap();
                    requested.send(route.to_owned()).unwrap();
                    if route == "/stall" {
                        let mut sink = Vec::new();
                        tokio::io::AsyncReadExt::read_to_end(&mut socket, &mut sink)
                            .await
                            .unwrap();
                    } else {
                        let body = if route == "/one" { "one" } else { "two" };
                        respond(socket, format!("HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\n{body}").as_bytes()).await;
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
        let (stop, mut cancel) = CancelSignal::channel();
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
            let (_send, mut cancel) = CancelSignal::channel();
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
    async fn completed_integrity_error_wins_over_concurrent_user_cancel() {
        use std::{
            future::Future,
            sync::Arc,
            task::{Context, Wake, Waker},
        };
        struct WorkerReady(tokio::sync::Notify);
        impl Wake for WorkerReady {
            fn wake(self: Arc<Self>) {
                self.0.notify_one();
            }
        }
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let target = root.path().join("instance");
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let (mut entry, path) = seed_blob(root.path(), b"good");
        std::fs::remove_file(path).unwrap();
        entry.url = format!("http://{}", listener.local_addr().unwrap());
        let mut manifest = build_manifest(serde_json::from_str("{}").unwrap()).unwrap();
        manifest.files.push(entry);
        let (stop, mut cancel) = CancelSignal::channel();
        let install = install_manifest(
            archive(&[]),
            manifest,
            target.clone(),
            &store,
            InstallDecision::default(),
            &mut cancel,
            |_, _| {},
        );
        tokio::pin!(install);
        tokio::time::timeout(std::time::Duration::from_secs(5), async {
            let socket = tokio::select! {
                _ = &mut install => panic!("install returned before response"),
                (socket, _) = accept_request(&listener) => socket,
            };
            // Pause the install coordinator after admission. Its only worker will
            // wake this waker when it has the result of the mismatched download.
            let ready = Arc::new(WorkerReady(tokio::sync::Notify::new()));
            let waker = Waker::from(ready.clone());
            assert!(install
                .as_mut()
                .poll(&mut Context::from_waker(&waker))
                .is_pending());
            respond(socket, b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nxxxx").await;
            ready.0.notified().await;
            stop.send_replace(true);
            assert!(install.await.err().unwrap().contains("Hash mismatch"));
        })
        .await
        .unwrap();
        assert!(!target.exists());
    }

    #[tokio::test]
    async fn override_only_install_does_not_open_object_cache() {
        let root = tempfile::tempdir().unwrap();
        std::fs::write(root.path().join("cache"), b"occupied").unwrap();
        let store = ModStore::new(root.path());
        let target = root.path().join("instance");
        let (_tx, mut cancel) = CancelSignal::channel();
        let manifest = build_manifest(serde_json::from_str("{}").unwrap()).unwrap();
        let result = install_manifest(
            archive(&[("overrides/options.txt", "content")]),
            manifest,
            target.clone(),
            &store,
            InstallDecision::default(),
            &mut cancel,
            |_, _| {},
        )
        .await;
        assert!(result.is_ok());
        assert_eq!(
            std::fs::read(target.join("minecraft/options.txt")).unwrap(),
            b"content"
        );
    }

    #[tokio::test]
    async fn cancelled_repair_cannot_publish_staged_overrides_or_blobs() {
        for cached in [false, true] {
            let root = tempfile::tempdir().unwrap();
            let target = root.path().join("live");
            let flags = CancelFlags::default();
            let registration = flags.register("repair");
            let dest = target.clone();
            let blob = root.path().join("cached");
            let (ready, staged) = tokio::sync::oneshot::channel();
            let (release, resume) = std::sync::mpsc::channel();
            let worker = tokio::task::spawn_blocking(move || {
                let stage = if cached {
                    std::fs::write(&blob, b"verified").unwrap();
                    stage_blob(&blob, &dest).unwrap()
                } else {
                    stage_override(b"override".as_slice(), &dest, &registration).unwrap()
                };
                ready.send(()).unwrap();
                resume
                    .recv_timeout(std::time::Duration::from_secs(5))
                    .unwrap();
                publish_repair(stage, &dest, &registration)
            });
            staged.await.unwrap();
            assert!(flags.cancel("repair").await.unwrap());
            release.send(()).unwrap();
            assert_eq!(worker.await.unwrap().unwrap_err(), "Installation cancelled");
            assert!(!target.exists());
        }
    }

    #[tokio::test]
    async fn cancelled_mirror_retry_preserves_observed_failure() {
        for (response, diagnostic) in [
            (
                b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nxxxx".as_slice(),
                "Hash mismatch",
            ),
            (
                b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n".as_slice(),
                "404",
            ),
        ] {
            let root = tempfile::tempdir().unwrap();
            let store = ModStore::new(root.path());
            let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
                .await
                .unwrap();
            let addr = listener.local_addr().unwrap();
            let (mut file, blob) = seed_blob(root.path(), b"good");
            std::fs::remove_file(&blob).unwrap();
            file.url = format!("http://{addr}/primary");
            file.mirrors = vec![format!("http://{addr}/retry")];
            let mut manifest = build_manifest(serde_json::from_str("{}").unwrap()).unwrap();
            manifest.files.push(file);
            let target = root.path().join("instance");
            let (stop, mut cancel) = CancelSignal::channel();
            let install = install_manifest(
                archive(&[]),
                manifest,
                target.clone(),
                &store,
                InstallDecision::default(),
                &mut cancel,
                |_, _| {},
            );
            let server = async {
                let (socket, route) = accept_request(&listener).await;
                assert!(route.contains("/primary"));
                respond(socket, response).await;
                let (held, route) = accept_request(&listener).await;
                assert!(route.contains("/retry"));
                stop.send_replace(true);
                held
            };
            let (result, _held) = tokio::time::timeout(std::time::Duration::from_secs(5), async {
                tokio::join!(install, server)
            })
            .await
            .unwrap();
            assert!(result.err().unwrap().contains(diagnostic));
            assert!(!target.exists());
            assert!(!blob.exists());
        }
    }

    #[tokio::test]
    async fn sibling_404_cancels_stalled_retry_and_reports_prior_integrity_error() {
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let addr = listener.local_addr().unwrap();
        let mut manifest = build_manifest(serde_json::from_str("{}").unwrap()).unwrap();
        for route in ["primary", "missing"] {
            let (mut file, blob) = seed_blob(root.path(), route.as_bytes());
            std::fs::remove_file(blob).unwrap();
            file.url = format!("http://{addr}/{route}");
            file.path = route.into();
            if route == "primary" {
                file.mirrors.push(format!("http://{addr}/retry"));
            }
            manifest.files.push(file);
        }
        let (_tx, mut cancel) = CancelSignal::channel();
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
        let server = async {
            let (first, route) = accept_request(&listener).await;
            let (second, _) = accept_request(&listener).await;
            let (primary, missing) = if route.contains("/primary") {
                (first, second)
            } else {
                (second, first)
            };
            respond(
                primary,
                b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\n\r\ncorrupt",
            )
            .await;
            let (mut held, route) = accept_request(&listener).await;
            assert!(route.contains("/retry"));
            tokio::io::AsyncWriteExt::write_all(
                &mut held,
                b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\n\r\np",
            )
            .await
            .unwrap();
            respond(
                missing,
                b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n",
            )
            .await;
            held
        };
        let (result, _held) = tokio::time::timeout(std::time::Duration::from_secs(5), async {
            tokio::join!(attempt, server)
        })
        .await
        .unwrap();
        assert!(result.err().unwrap().contains("Hash mismatch"));
        assert!(!target.exists());
    }

    #[tokio::test]
    async fn terminal_integrity_failure_drains_stalled_sibling() {
        use tokio::io::AsyncWriteExt;
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let addr = listener.local_addr().unwrap();
        let mut manifest = build_manifest(serde_json::from_str("{}").unwrap()).unwrap();
        let mut stalled_shard = PathBuf::new();
        for body in ["bad", "stall"] {
            let (mut file, blob) = seed_blob(root.path(), body.as_bytes());
            if body == "stall" {
                stalled_shard = blob.parent().unwrap().to_owned();
            }
            std::fs::remove_file(blob).unwrap();
            file.url = format!("http://{addr}/{body}");
            file.path = body.into();
            manifest.files.push(file);
        }
        let (_tx, mut cancel) = CancelSignal::channel();
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
        let server = async {
            let (first, route) = accept_request(&listener).await;
            let (second, _) = accept_request(&listener).await;
            let (mut stall, bad) = if route.contains("/stall") {
                (first, second)
            } else {
                (second, first)
            };
            stall
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\ns")
                .await
                .unwrap();
            while tokio::fs::read_dir(&stalled_shard)
                .await
                .unwrap()
                .next_entry()
                .await
                .unwrap()
                .is_none()
            {
                tokio::task::yield_now().await;
            }
            respond(bad, b"HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nxxx").await;
            stall
        };
        let (result, _held) = tokio::time::timeout(std::time::Duration::from_secs(5), async {
            tokio::join!(attempt, server)
        })
        .await
        .unwrap();
        assert!(result.err().unwrap().contains("Hash mismatch"));
        assert!(!*cancel.borrow());
        assert!(!target.exists());
    }

    #[tokio::test]
    async fn clear_admits_install_to_new_tree_while_old_body_stalls() {
        use tokio::io::AsyncWriteExt;
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let (mut file, blob) = seed_blob(root.path(), b"blob");
        std::fs::remove_file(&blob).unwrap();
        file.url = format!("http://{}", listener.local_addr().unwrap());
        let manifest = || {
            let mut manifest = build_manifest(serde_json::from_str("{}").unwrap()).unwrap();
            manifest.files.push(file.clone());
            manifest
        };
        let initial = std::sync::Arc::downgrade(&store.lease().await.unwrap());
        let (_tx, mut cancel) = CancelSignal::channel();
        let mut second_cancel = cancel.clone();
        let a = root.path().join("a");
        let b = root.path().join("b");
        let install_a = install_manifest(
            archive(&[]),
            manifest(),
            a.clone(),
            &store,
            InstallDecision::default(),
            &mut cancel,
            |_, _| {},
        );
        let exercise = async {
            let (mut stalled, _) = accept_request(&listener).await;
            stalled
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nb")
                .await
                .unwrap();
            let clear = store.clear();
            tokio::pin!(clear);
            assert!(futures_util::poll!(&mut clear).is_pending());
            while std::sync::Weak::ptr_eq(
                &std::sync::Arc::downgrade(&store.lease().await.unwrap()),
                &initial,
            ) {
                tokio::task::yield_now().await;
            }
            let (result, ()) = tokio::join!(
                install_manifest(
                    archive(&[]),
                    manifest(),
                    b.clone(),
                    &store,
                    InstallDecision::default(),
                    &mut second_cancel,
                    |_, _| {}
                ),
                async {
                    let (socket, _) = accept_request(&listener).await;
                    respond(socket, b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nblob").await;
                }
            );
            assert!(result.is_ok());
            assert_eq!(
                std::fs::read(b.join("minecraft/mods/item.jar")).unwrap(),
                b"blob"
            );
            assert!(futures_util::poll!(&mut clear).is_pending());
            stalled.write_all(b"lob").await.unwrap();
            clear.await.unwrap();
        };
        let (result, ()) = tokio::time::timeout(std::time::Duration::from_secs(5), async {
            tokio::join!(install_a, exercise)
        })
        .await
        .unwrap();
        assert!(result.is_ok());
        assert_eq!(
            std::fs::read(a.join("minecraft/mods/item.jar")).unwrap(),
            b"blob"
        );
        assert!(!blob.exists());
        drop(listener);
        let active = store.lease().await.unwrap();
        let (_tx, cancel) = CancelSignal::channel();
        assert_eq!(
            std::fs::read(active.ensure(&file, &cancel, None).await.unwrap()).unwrap(),
            b"blob"
        );
    }

    #[tokio::test]
    async fn installs_reject_contradictions_and_evict_same_size_corruption() {
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
            let (_stop, mut cancel) = CancelSignal::channel();
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
                    let (socket, _) = accept_request(&listener).await;
                    respond(socket, b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nevil").await;
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
        let (_stop, cancel) = CancelSignal::channel();
        let store = store.lease().await.unwrap();
        let (result, ()) = tokio::join!(store.ensure(&file, &cancel, None), async {
            for response in [
                b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n".as_slice(),
                b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\ngood",
            ] {
                let (socket, _) = accept_request(&listener).await;
                respond(socket, response).await;
            }
        });
        assert_eq!(result.unwrap(), path);
        assert_eq!(std::fs::read(path).unwrap(), b"good");
    }

    #[tokio::test]
    async fn missing_legacy_archive_permits_launch_and_keeps_migration_pending() {
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let (_tx, mut rx) = CancelSignal::channel();
        for path in [root.path().join("moved.mrpack"), root.path().to_owned()] {
            assert_eq!(
                repair(
                    path,
                    root.path().join("minecraft"),
                    &store,
                    &mut rx,
                    |_, _| {}
                )
                .await
                .unwrap(),
                RepairOutcome::ArchiveUnavailable
            );
        }
    }
    #[tokio::test]
    async fn legacy_repair_restores_missing_files_with_client_precedence() {
        let root = tempfile::tempdir().unwrap();
        let store = ModStore::new(root.path());
        let (file, _) = seed_blob(root.path(), b"good");
        let indexed = serde_json::json!({"path":file.path,"hashes":{"sha1":file.sha1,"sha512":file.sha512},"downloads":[file.url],"fileSize":file.file_size});
        let mut existing = indexed.clone();
        existing["path"] = "options.txt".into();
        let mut disabled = indexed.clone();
        disabled["path"] = "Mods/disabled.jar".into();
        let index = serde_json::json!({"files":[indexed,existing,disabled]}).to_string();
        let mut zip = archive(&[
            (MANIFEST_ENTRY, &index),
            ("overrides/options.txt", "default"),
            ("client-overrides/new.cfg", "new"),
            ("overrides/new.cfg", "old"),
            ("overrides/common.cfg", "bundled"),
            ("client-overrides/Mods/disabled.jar", "enabled"),
        ])
        .into_inner();
        use std::io::Seek;
        zip.rewind().unwrap();
        let pack = root.path().join("legacy.mrpack");
        std::io::copy(&mut zip, &mut File::create(&pack).unwrap()).unwrap();
        let minecraft = root.path().join("instance/minecraft");
        std::fs::create_dir_all(minecraft.join("mods")).unwrap();
        std::fs::create_dir_all(minecraft.join("Mods")).unwrap();
        std::fs::write(minecraft.join("Mods/disabled.jar.disabled"), "edited").unwrap();
        std::fs::write(minecraft.join("options.txt"), "edited").unwrap();
        let (stop, mut cancel) = CancelSignal::channel();
        let abort = stop.clone();
        let interrupted = repair(
            pack.clone(),
            minecraft.clone(),
            &store,
            &mut cancel,
            move |done, total| {
                if total > 1 && done == 1 {
                    abort.send_replace(true);
                }
            },
        )
        .await;
        assert!(matches!(interrupted, Err(reason) if reason=="Installation cancelled"));
        assert!(!minecraft.join("mods/item.jar").exists());
        stop.send_replace(false);
        assert_eq!(
            repair(
                pack.clone(),
                minecraft.clone(),
                &store,
                &mut cancel,
                |_, _| {}
            )
            .await
            .unwrap(),
            RepairOutcome::Repaired
        );
        assert_eq!(
            std::fs::read(minecraft.join("mods/item.jar")).unwrap(),
            b"good"
        );
        assert_eq!(
            std::fs::read(minecraft.join("options.txt")).unwrap(),
            b"edited"
        );
        assert_eq!(std::fs::read(minecraft.join("new.cfg")).unwrap(), b"new");
        assert_eq!(
            std::fs::read(minecraft.join("common.cfg")).unwrap(),
            b"bundled"
        );
        assert!(!minecraft.join("Mods/disabled.jar").exists());

        let other = tempfile::tempdir().unwrap();
        std::fs::write(other.path().join("cache"), b"occupied").unwrap();
        let unusable = ModStore::new(other.path());
        assert_eq!(
            repair(
                pack.clone(),
                minecraft.clone(),
                &unusable,
                &mut cancel,
                |_, _| {}
            )
            .await
            .unwrap(),
            RepairOutcome::Repaired
        );
        std::fs::remove_file(minecraft.join("mods/item.jar")).unwrap();
        let cache_error = unusable.lease().await.err().unwrap();
        assert_eq!(
            repair(pack, minecraft, &unusable, &mut cancel, |_, _| {})
                .await
                .unwrap_err(),
            cache_error
        );
    }
}
