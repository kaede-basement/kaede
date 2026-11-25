///
/// ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning),
/// but the code here was initially written by me in TypeScript (so this is a rewrite)
///
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::Duration,
};

use crate::hashing::{to_hex, HashAlgorithm};
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, State};
use tokio::{
    io::AsyncWriteExt,
    sync::{watch, OnceCell},
};

static CLIENT: OnceCell<reqwest::Client> = OnceCell::const_new();
type StagingDirectories = Mutex<HashMap<Arc<same_file::Handle>, (Arc<Staging>, usize)>>;
static STAGING: OnceLock<StagingDirectories> = OnceLock::new();

struct Staging {
    directory: tempfile::TempDir,
    transfers: Mutex<HashMap<Arc<same_file::Handle>, Transfer>>,
}

struct Transfer {
    entry: DownloadEntry,
    done: watch::Sender<bool>,
}

enum Claim {
    Owner(Owner),
    Waiting {
        done: watch::Receiver<bool>,
        matches: bool,
    },
}

struct Owner {
    stage: Arc<Staging>,
    marker: Option<(Arc<same_file::Handle>, tempfile::TempPath)>,
    published: bool,
}

impl Drop for Owner {
    fn drop(&mut self) {
        let mut transfers = self.stage.transfers.lock().unwrap();
        let (identity, marker) = self.marker.take().unwrap();
        let transfer = transfers.remove(&identity).unwrap();
        drop(identity);
        drop(marker);
        transfer.done.send_replace(self.published);
    }
}

struct StagingDirectory {
    parent: Arc<same_file::Handle>,
    directory: Arc<Staging>,
}

impl StagingDirectory {
    fn open(parent: &Path) -> std::io::Result<Self> {
        let parent_id = Arc::new(same_file::Handle::from_path(parent)?);
        let mut active = STAGING.get_or_init(Default::default).lock().unwrap();
        let (dir, owners) = match active.entry(parent_id.clone()) {
            std::collections::hash_map::Entry::Occupied(entry) => entry.into_mut(),
            std::collections::hash_map::Entry::Vacant(entry) => entry.insert((
                Arc::new(Staging {
                    directory: tempfile::tempdir_in(parent)?,
                    transfers: Mutex::default(),
                }),
                0,
            )),
        };
        *owners += 1;
        let directory = dir.clone();
        Ok(Self {
            parent: parent_id,
            directory,
        })
    }

    // create_new lets the destination filesystem decide whether two names alias.
    fn claim(&self, name: &std::ffi::OsStr, entry: &DownloadEntry) -> std::io::Result<Claim> {
        let stage = &self.directory;
        let path = stage.directory.path().join(name);
        let mut transfers = stage.transfers.lock().unwrap();
        match std::fs::File::options()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(file) => {
                let marker = tempfile::TempPath::from_path(path);
                let identity = Arc::new(same_file::Handle::from_file(file)?);
                transfers.insert(
                    identity.clone(),
                    Transfer {
                        entry: entry.clone(),
                        done: watch::channel(false).0,
                    },
                );
                Ok(Claim::Owner(Owner {
                    stage: stage.clone(),
                    marker: Some((identity, marker)),
                    published: false,
                }))
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                let identity = same_file::Handle::from_path(path)?;
                let transfer = transfers
                    .get(&identity)
                    .ok_or_else(|| std::io::Error::other("Missing download owner"))?;
                Ok(Claim::Waiting {
                    matches: transfer.entry.same_transfer(entry),
                    done: transfer.done.subscribe(),
                })
            }
            Err(e) => Err(e),
        }
    }
}
impl Drop for StagingDirectory {
    fn drop(&mut self) {
        let mut active = STAGING.get().unwrap().lock().unwrap();
        let (_, owners) = active.get_mut(&self.parent).unwrap();
        *owners -= 1;
        if *owners == 0 {
            active.remove(&self.parent);
        }
    }
}

#[derive(Clone, Default, Deserialize)]
pub struct DownloadEntry {
    pub url: String,
    pub path: String,
    pub hash: Option<String>,
    pub algorithm: Option<HashAlgorithm>,
    pub size: Option<u64>,
}

impl DownloadEntry {
    fn same_transfer(&self, other: &Self) -> bool {
        self.url == other.url
            && self.algorithm == other.algorithm
            && self.size == other.size
            && match (&self.hash, &other.hash) {
                (Some(a), Some(b)) => a.eq_ignore_ascii_case(b),
                (None, None) => true,
                _ => false,
            }
    }
}

pub(crate) struct FileProgress {
    downloaded: Arc<AtomicU64>,
    total: u64,
    last_downloaded: u64,
}

#[derive(Serialize, Clone)]
pub struct DownloadSnapshot {
    // path -> [percent, bytes_per_second]
    current: HashMap<String, (u8, u64)>,
    success: usize,
    failed: usize,
}

#[derive(Serialize)]
pub struct FailedDownload {
    url: String,
    path: String,
    error: String,
}

#[derive(Serialize)]
pub struct DownloadReport {
    success: usize,
    failed: usize,
    cancelled: bool,
    failures: Vec<FailedDownload>,
}

#[derive(Debug)]
pub(crate) enum DownloadError {
    Cancelled,
    Other(String),
}

impl DownloadError {
    fn other(error: impl ToString) -> Self {
        DownloadError::Other(error.to_string())
    }
}

#[derive(Default)]
pub struct CancelFlags(Mutex<HashMap<String, CancelEntry>>);

struct CancelEntry {
    flag: watch::Sender<bool>,
    batches: usize,
    decision: Option<InstallDecision>,
    started: bool,
}

#[derive(Clone, Default)]
pub(crate) struct InstallDecision(Arc<AtomicBool>);

impl InstallDecision {
    fn claim(&self) -> bool {
        !self.0.swap(true, Ordering::AcqRel)
    }

    pub fn publish(&self, stage: &Path, target: &Path) -> Result<(), String> {
        if !self.claim() {
            return Err("Installation cancelled".into());
        }
        std::fs::rename(stage, target).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn prepare_mrpack_install(flags: State<CancelFlags>, cancel_id: String) -> Result<(), String> {
    flags.reserve_install(cancel_id)
}

impl CancelFlags {
    fn reserve_install(&self, id: String) -> Result<(), String> {
        let mut entries = self.0.lock().unwrap();
        if entries.contains_key(&id) {
            return Err("Install ID already active".into());
        }
        entries.insert(
            id,
            CancelEntry {
                flag: watch::channel(false).0,
                batches: 1,
                decision: Some(InstallDecision::default()),
                started: false,
            },
        );
        Ok(())
    }

    pub(crate) fn start_install(
        &self,
        id: &str,
    ) -> Result<(watch::Receiver<bool>, InstallDecision), String> {
        let mut entries = self.0.lock().unwrap();
        let entry = entries.get_mut(id).ok_or("Unknown install ID")?;
        let decision = entry.decision.clone().ok_or("Not an install ID")?;
        if entry.started {
            return Err("Install already started".into());
        }
        entry.started = true;
        Ok((entry.flag.subscribe(), decision))
    }

    fn cancel(&self, id: &str) -> bool {
        let entries = self.0.lock().unwrap();
        let Some(entry) = entries.get(id) else {
            return false;
        };
        if entry.decision.as_ref().is_some_and(|d| !d.claim()) {
            return false;
        }
        entry.flag.send_replace(true);
        true
    }

    pub(crate) fn register(&self, id: &str) -> watch::Receiver<bool> {
        let mut map = self.0.lock().unwrap();
        let entry = map.entry(id.to_string()).or_insert_with(|| CancelEntry {
            flag: watch::channel(false).0,
            batches: 0,
            decision: None,
            started: false,
        });

        entry.batches += 1;

        entry.flag.subscribe()
    }

    pub(crate) fn deregister(&self, id: &str) {
        let mut map = self.0.lock().unwrap();

        if let Some(entry) = map.get_mut(id) {
            entry.batches -= 1;

            if entry.batches == 0 {
                map.remove(id);
            }
        }
    }
}

pub(crate) async fn client() -> Result<&'static reqwest::Client, String> {
    CLIENT
        .get_or_try_init(|| async {
            reqwest::Client::builder()
                .connect_timeout(Duration::from_secs(30))
                .read_timeout(Duration::from_secs(30))
                .build()
        })
        .await
        .map_err(|error| error.to_string())
}

pub(crate) type Progress = Arc<Mutex<HashMap<String, FileProgress>>>;

#[tauri::command]
pub fn cancel_downloads(state: State<CancelFlags>, cancel_id: String) -> bool {
    state.cancel(&cancel_id)
}

#[tauri::command]
pub async fn concurrently_download(
    state: State<'_, CancelFlags>,
    entries: Vec<DownloadEntry>,
    concurrency: usize,
    label: String,
    cancel_id: String,
    on_progress: Channel<DownloadSnapshot>,
    debug: bool,
) -> Result<DownloadReport, String> {
    let concurrency = concurrency.max(1).min(entries.len());

    let client = client().await?;
    let cancel = state.register(&cancel_id);
    let entries = Arc::new(entries);
    let next_index = Arc::new(AtomicUsize::new(0));
    let progress: Progress = Arc::default();
    let success = Arc::new(AtomicUsize::new(0));
    let failed = Arc::new(AtomicUsize::new(0));

    // One snapshot per tick for the whole batch
    let ticker = tauri::async_runtime::spawn({
        let progress = Arc::clone(&progress);
        let success = Arc::clone(&success);
        let failed = Arc::clone(&failed);
        let channel = on_progress.clone();

        async move {
            let mut interval = tokio::time::interval(Duration::from_millis(100));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            interval.tick().await;
            loop {
                interval.tick().await;

                let current = {
                    let mut files = progress.lock().unwrap();

                    files
                        .iter_mut()
                        .map(|(path, file)| {
                            // Ticks are 100ms apart, so delta * 10 is roughly bytes/sec
                            let downloaded = file.downloaded.load(Ordering::Relaxed);
                            let speed = (downloaded - file.last_downloaded) * 10;
                            file.last_downloaded = downloaded;

                            let percent = match file.total {
                                0 => 0,
                                total => (downloaded.saturating_mul(100) / total).min(100) as u8,
                            };

                            (path.clone(), (percent, speed))
                        })
                        .collect::<HashMap<_, _>>()
                };

                let _ = channel.send(DownloadSnapshot {
                    current,
                    success: success.load(Ordering::Relaxed),
                    failed: failed.load(Ordering::Relaxed),
                });
            }
        }
    });

    let mut workers = Vec::with_capacity(concurrency);

    for _ in 0..concurrency {
        let label = label.clone();
        let entries = Arc::clone(&entries);
        let next_index = Arc::clone(&next_index);
        let progress = Arc::clone(&progress);
        let success = Arc::clone(&success);
        let failed = Arc::clone(&failed);
        let mut cancel = cancel.clone();

        workers.push(tauri::async_runtime::spawn(async move {
            let mut failures: Vec<FailedDownload> = Vec::new();

            loop {
                if *cancel.borrow() {
                    break;
                }

                let index = next_index.fetch_add(1, Ordering::Relaxed);

                let Some(entry) = entries.get(index) else {
                    break;
                };

                let result = download_one(client, entry, &progress, &mut cancel).await;

                match result {
                    Ok(()) => {
                        success.fetch_add(1, Ordering::Relaxed);
                        if debug {
                            log::debug!("{label}: downloaded '{}'", entry.url);
                        }
                    }
                    Err(DownloadError::Cancelled) => {
                        if debug {
                            log::debug!("{label}: cancelled '{}'", entry.url);
                        }
                        break;
                    }
                    Err(DownloadError::Other(error)) => {
                        failed.fetch_add(1, Ordering::Relaxed);
                        log::error!("{label}: could not download '{}': {error}", entry.url);
                        failures.push(FailedDownload {
                            url: entry.url.clone(),
                            path: entry.path.clone(),
                            error,
                        });
                    }
                }
            }

            failures
        }));
    }

    let mut failures: Vec<FailedDownload> = Vec::new();

    for worker in workers {
        match worker.await {
            Ok(worker_failures) => failures.extend(worker_failures),
            Err(e) => {
                failed.fetch_add(1, Ordering::Relaxed);
                failures.push(FailedDownload {
                    path: String::new(),
                    url: String::new(),
                    error: e.to_string(),
                });
            }
        }
    }

    ticker.abort();
    let _ = ticker.await;
    state.deregister(&cancel_id);

    let report = DownloadReport {
        success: success.load(Ordering::Relaxed),
        failed: failed.load(Ordering::Relaxed),
        cancelled: *cancel.borrow(),
        failures,
    };

    // Final snapshot
    let _ = on_progress.send(DownloadSnapshot {
        current: HashMap::new(),
        success: report.success,
        failed: report.failed,
    });

    Ok(report)
}

async fn download_one(
    client: &reqwest::Client,
    entry: &DownloadEntry,
    progress: &Progress,
    cancel: &mut watch::Receiver<bool>,
) -> Result<(), DownloadError> {
    let path = PathBuf::from(&entry.path);
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."))
        .to_owned();
    let name = path
        .file_name()
        .ok_or_else(|| DownloadError::other("Missing destination filename"))?;
    let target_dir = parent.clone();
    let staging = tokio::task::spawn_blocking(move || {
        std::fs::create_dir_all(&target_dir)?;
        StagingDirectory::open(&target_dir)
    })
    .await
    .map_err(DownloadError::other)?
    .map_err(DownloadError::other)?;
    let mut owner = loop {
        match staging.claim(name, entry).map_err(DownloadError::other)? {
            Claim::Owner(owner) => break owner,
            Claim::Waiting { mut done, matches } => tokio::select! {
                biased;
                _ = cancel.wait_for(|value| *value) => return Err(DownloadError::Cancelled),
                _ = done.changed() => {
                    if *done.borrow() {
                        if matches {return Ok(());}
                        return Err(DownloadError::other(format!("A different URL or integrity expectation was published for {}",entry.path)));
                    }
                }
            },
        }
    };
    let hashes = match (entry.algorithm, entry.hash.as_deref()) {
        (Some(kind), Some(hash)) => vec![(kind, hash)],
        (None, None) => Vec::new(),
        _ => return Err(DownloadError::other("Expected both algorithm and hash")),
    };
    stream_file(
        client, &entry.url, &path, entry.size, &hashes, progress, cancel,
    )
    .await?;
    owner.published = true;
    Ok(())
}

pub(crate) async fn stream_file(
    client: &reqwest::Client,
    url: &str,
    path: &Path,
    size: Option<u64>,
    hashes: &[(HashAlgorithm, &str)],
    progress: &Progress,
    cancel: &mut watch::Receiver<bool>,
) -> Result<(), DownloadError> {
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut hashers = Vec::new();
    for &(kind, hash) in hashes {
        kind.validate(hash).map_err(DownloadError::other)?;
        hashers.push((hash, kind.hasher()));
    }
    let mut response = tokio::select! {
        biased;
        _ = cancel.wait_for(|value| *value) => return Err(DownloadError::Cancelled),
        result = client.get(url).send() => result.and_then(|r| r.error_for_status()).map_err(DownloadError::other)?,
    };
    let (file, mut partial) = crate::file_system::staging_file(parent)
        .map_err(DownloadError::other)?
        .into_parts();
    let mut writer = tokio::io::BufWriter::new(tokio::fs::File::from_std(file));
    let downloaded = Arc::new(AtomicU64::new(0));
    progress.lock().unwrap().insert(
        path.to_string_lossy().into_owned(),
        FileProgress {
            downloaded: downloaded.clone(),
            total: response.content_length().unwrap_or(0),
            last_downloaded: 0,
        },
    );
    let result = async {
        loop {
            let chunk = tokio::select! {
                biased;
                _ = cancel.wait_for(|value| *value) => return Err(DownloadError::Cancelled),
                result = response.chunk() => result.map_err(DownloadError::other)?,
            };
            let Some(chunk) = chunk else { break };
            if size.is_some_and(|limit| {
                downloaded
                    .load(Ordering::Relaxed)
                    .saturating_add(chunk.len() as u64)
                    > limit
            }) {
                return Err(DownloadError::other(format!(
                    "Size mismatch for {}",
                    path.display()
                )));
            }
            for (_, hasher) in &mut hashers {
                hasher.update(&chunk);
            }
            writer
                .write_all(&chunk)
                .await
                .map_err(DownloadError::other)?;
            downloaded.fetch_add(chunk.len() as u64, Ordering::Relaxed);
        }
        Ok(())
    }
    .await;
    let shutdown = writer.shutdown().await;
    drop(writer.into_inner().into_std().await);
    progress
        .lock()
        .unwrap()
        .remove(path.to_string_lossy().as_ref());
    result?;
    shutdown.map_err(DownloadError::other)?;
    if size.is_some_and(|size| size != downloaded.load(Ordering::Relaxed)) {
        return Err(DownloadError::other(format!(
            "Size mismatch for {}",
            path.display()
        )));
    }
    for (expected, hasher) in hashers {
        if !to_hex(&hasher.finalize()).eq_ignore_ascii_case(expected) {
            return Err(DownloadError::other(format!(
                "Hash mismatch for {}",
                path.display()
            )));
        }
    }
    if *cancel.borrow() {
        return Err(DownloadError::Cancelled);
    }
    tokio::fs::rename(&*partial, path)
        .await
        .map_err(DownloadError::other)?;
    partial.disable_cleanup(true);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_and_publication_have_one_winner() {
        let root = tempfile::tempdir().unwrap();
        let flags = CancelFlags::default();
        for _ in 0..16 {
            let stage = tempfile::tempdir_in(root.path()).unwrap();
            let target = root.path().join("instance");
            flags.reserve_install("install".into()).unwrap();
            let (_, decision) = flags.start_install("install").unwrap();
            let barrier = std::sync::Barrier::new(2);
            std::thread::scope(|scope| {
                let cancel = scope.spawn(|| {
                    barrier.wait();
                    flags.cancel("install")
                });
                barrier.wait();
                let published = decision.publish(stage.path(), &target).is_ok();
                assert_eq!(cancel.join().unwrap(), !published);
                assert_eq!(target.exists(), published);
            });
            flags.deregister("install");
            if target.exists() {
                std::fs::remove_dir(target).unwrap();
            }
        }
    }

    #[tokio::test]
    async fn corrupt_download_never_replaces_good_destination() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("item");
        std::fs::write(&path, b"original").unwrap();
        for (algorithm, hash, size) in [
            (Some(HashAlgorithm::Sha1), Some("0".repeat(40)), None),
            (Some(HashAlgorithm::Sha512), Some("0".repeat(128)), None),
            (None, None, Some(2)),
            (None, None, Some(4)),
        ] {
            let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
                .await
                .unwrap();
            let entry = DownloadEntry {
                url: format!("http://{}/", listener.local_addr().unwrap()),
                path: path.to_str().unwrap().into(),
                algorithm,
                hash,
                size,
            };
            let (_tx, mut cancel) = watch::channel(false);
            let progress = Progress::default();
            let client = reqwest::Client::builder().no_proxy().build().unwrap();
            let (result, ()) = tokio::join!(
                download_one(&client, &entry, &progress, &mut cancel),
                async {
                    let (mut socket, _) = listener.accept().await.unwrap();
                    socket
                        .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nbad")
                        .await
                        .unwrap();
                }
            );
            assert!(matches!(result,Err(DownloadError::Other(e)) if e.contains("mismatch")));
            assert_eq!(std::fs::read(&path).unwrap(), b"original");
            assert_eq!(dir.path().read_dir().unwrap().count(), 1);
        }
    }

    #[tokio::test]
    async fn owner_failure_releases_waiters_for_retry() {
        let root = tempfile::tempdir().unwrap();
        let directory = StagingDirectory::open(root.path()).unwrap();
        let name = std::ffi::OsStr::new("item");
        let Claim::Owner(owner) = directory.claim(name, &DownloadEntry::default()).unwrap() else {
            panic!()
        };
        let Claim::Waiting { mut done, .. } =
            directory.claim(name, &DownloadEntry::default()).unwrap()
        else {
            panic!()
        };
        drop(owner);
        done.changed().await.unwrap();
        assert!(!*done.borrow());
        assert!(matches!(
            directory.claim(name, &DownloadEntry::default()).unwrap(),
            Claim::Owner(_)
        ));
    }
    #[tokio::test]
    async fn cancellation_wakes_all_registered_batches_and_resets() {
        let flags = CancelFlags::default();
        let mut a = flags.register("shared");
        let mut b = flags.register("shared");
        flags.deregister("shared");
        flags.0.lock().unwrap()["shared"].flag.send_replace(true);
        a.changed().await.unwrap();
        b.changed().await.unwrap();
        assert!(*b.borrow());
        flags.deregister("shared");
        assert!(!*flags.register("shared").borrow());
    }
    #[tokio::test]
    async fn stalled_response_is_cancellable_before_headers_and_during_body() {
        use tokio::net::TcpListener;
        for send_headers in [false, true] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("item");
            std::fs::write(&path, b"original").unwrap();
            let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
            let entry = DownloadEntry {
                path: path.to_str().unwrap().to_owned(),
                url: format!("http://{}/", listener.local_addr().unwrap()),
                ..Default::default()
            };
            let flags = CancelFlags::default();
            let mut cancel = flags.register("one");
            let progress = Progress::default();
            let client = reqwest::Client::builder().no_proxy().build().unwrap();
            let download = download_one(&client, &entry, &progress, &mut cancel);
            let exercise = async {
                let (mut socket, _) = listener.accept().await.unwrap();
                if send_headers {
                    socket
                        .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\nx")
                        .await
                        .unwrap();
                    loop {
                        if progress
                            .lock()
                            .unwrap()
                            .get(&entry.path)
                            .is_some_and(|p| p.downloaded.load(Ordering::Relaxed) == 1)
                        {
                            break;
                        }
                        tokio::task::yield_now().await;
                    }
                }
                flags.0.lock().unwrap()["one"].flag.send_replace(true);
                socket
            };
            let (result, _socket) = tokio::time::timeout(Duration::from_secs(5), async {
                tokio::join!(download, exercise)
            })
            .await
            .unwrap();
            assert!(matches!(result, Err(DownloadError::Cancelled)));
            assert_eq!(std::fs::read(path).unwrap(), b"original");
            assert_eq!(dir.path().read_dir().unwrap().count(), 1);
        }
    }
    async fn wait_for_competitor(staging: &StagingDirectory) {
        while !staging
            .directory
            .transfers
            .lock()
            .unwrap()
            .values()
            .any(|transfer| transfer.done.receiver_count() > 0)
        {
            tokio::task::yield_now().await;
        }
    }

    #[tokio::test]
    async fn waiting_transfer_can_cancel_or_take_over_after_owner_failure() {
        use tokio::net::TcpListener;
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("item");
        let stage = StagingDirectory::open(root.path()).unwrap();
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let entry = DownloadEntry {
            path: path.to_str().unwrap().into(),
            url: format!("http://{}/", listener.local_addr().unwrap()),
            ..Default::default()
        };
        let Claim::Owner(owner) = stage.claim(path.file_name().unwrap(), &entry).unwrap() else {
            panic!()
        };
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let flags = CancelFlags::default();
        let mut cancel = flags.register("cancel");
        let mut retry = flags.register("retry");
        let progress = Progress::default();
        tokio::time::timeout(Duration::from_secs(5), async {
            let (result, ()) = tokio::join!(
                download_one(&client, &entry, &progress, &mut cancel),
                async {
                    wait_for_competitor(&stage).await;
                    flags.0.lock().unwrap()["cancel"].flag.send_replace(true);
                }
            );
            assert!(matches!(result, Err(DownloadError::Cancelled)));
            let (result, ()) = tokio::join!(
                download_one(&client, &entry, &progress, &mut retry),
                async {
                    wait_for_competitor(&stage).await;
                    drop(owner);
                    let (mut socket, _) = listener.accept().await.unwrap();
                    socket
                        .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nnew")
                        .await
                        .unwrap();
                }
            );
            assert!(result.is_ok());
        })
        .await
        .unwrap();
        assert_eq!(std::fs::read(path).unwrap(), b"new");
    }

    #[tokio::test]
    async fn competing_download_uses_published_file() {
        use tokio::net::TcpListener;
        for (same_url, owner_fails) in [(true, false), (false, false), (false, true)] {
            let root = tempfile::tempdir().unwrap();
            let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
            let path = root.path().join("item");
            let owner = DownloadEntry {
                path: path.to_str().unwrap().into(),
                url: format!("http://{}/", listener.local_addr().unwrap()),
                ..Default::default()
            };
            let waiter = DownloadEntry {
                path: owner.path.clone(),
                size: if owner_fails { Some(2) } else { None },
                hash: owner_fails.then(|| crate::hashing::hash_bytes::<sha1::Sha1>(b"ok")),
                algorithm: owner_fails.then_some(HashAlgorithm::Sha1),
                url: if same_url {
                    owner.url.clone()
                } else {
                    format!("{}other", owner.url)
                },
            };
            let client = reqwest::Client::builder().no_proxy().build().unwrap();
            let flags = CancelFlags::default();
            let mut a = flags.register("a");
            let mut b = flags.register("b");
            let progress = Progress::default();
            let exercise = async {
                let (mut socket, _) = listener.accept().await.unwrap();
                let wait = download_one(&client, &waiter, &progress, &mut b);
                tokio::pin!(wait);
                let response = b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok";
                let observer = StagingDirectory::open(root.path()).unwrap();
                let (result, ()) = tokio::join!(wait, async {
                    wait_for_competitor(&observer).await;
                    if owner_fails {
                        socket.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await.unwrap();
                        let (mut retry, _) = listener.accept().await.unwrap();
                        retry.write_all(response).await.unwrap();
                    } else {
                        socket.write_all(response).await.unwrap();
                    }
                });
                result
            };
            let (a, b) = tokio::time::timeout(Duration::from_secs(5), async {
                tokio::join!(download_one(&client, &owner, &progress, &mut a), exercise)
            })
            .await
            .unwrap();
            assert_eq!(a.is_err(), owner_fails);
            if same_url || owner_fails {
                assert!(b.is_ok());
            } else {
                assert!(
                    matches!(b, Err(DownloadError::Other(error)) if error.contains("different URL"))
                );
            }
            assert_eq!(std::fs::read(path).unwrap(), b"ok");
        }
    }
}
