///
/// ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning),
/// but the code here was initially written by me in TypeScript (so this is a rewrite)
///
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, AtomicUsize, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::Duration,
};

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
    transfers: Mutex<HashMap<Arc<same_file::Handle>, watch::Sender<bool>>>,
}

enum Claim {
    Owner(Owner),
    Waiting(watch::Receiver<bool>),
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
        let done = transfers.remove(&identity).unwrap();
        drop(identity);
        drop(marker);
        done.send_replace(self.published);
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
    fn claim(&self, name: &std::ffi::OsStr) -> std::io::Result<Claim> {
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
                transfers.insert(identity.clone(), watch::channel(false).0);
                Ok(Claim::Owner(Owner {
                    stage: stage.clone(),
                    marker: Some((identity, marker)),
                    published: false,
                }))
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                let identity = same_file::Handle::from_path(path)?;
                let done = transfers
                    .get(&identity)
                    .ok_or_else(|| std::io::Error::other("Missing download owner"))?;
                Ok(Claim::Waiting(done.subscribe()))
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

#[derive(Deserialize)]
pub struct DownloadEntry {
    pub url: String,
    pub path: String,
}

struct FileProgress {
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

enum DownloadError {
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
}

impl CancelFlags {
    fn register(&self, id: &str) -> watch::Receiver<bool> {
        let mut map = self.0.lock().unwrap();
        let entry = map.entry(id.to_string()).or_insert_with(|| CancelEntry {
            flag: watch::channel(false).0,
            batches: 0,
        });

        entry.batches += 1;

        entry.flag.subscribe()
    }

    fn deregister(&self, id: &str) {
        let mut map = self.0.lock().unwrap();

        if let Some(entry) = map.get_mut(id) {
            entry.batches -= 1;

            if entry.batches == 0 {
                map.remove(id);
            }
        }
    }
}

type Progress = Arc<Mutex<HashMap<String, FileProgress>>>;

#[tauri::command]
pub fn cancel_downloads(state: State<CancelFlags>, cancel_id: String) -> bool {
    match state.0.lock().unwrap().get(&cancel_id) {
        Some(entry) => {
            entry.flag.send_replace(true);
            true
        }
        None => false,
    }
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

    let client = CLIENT
        .get_or_try_init(|| async {
            reqwest::Client::builder()
                .connect_timeout(Duration::from_secs(30))
                .read_timeout(Duration::from_secs(30))
                .build()
        })
        .await
        .map_err(|error| error.to_string())?;
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
        match staging.claim(name).map_err(DownloadError::other)? {
            Claim::Owner(owner) => break owner,
            Claim::Waiting(mut done) => tokio::select! {
                biased;
                _ = cancel.wait_for(|value| *value) => return Err(DownloadError::Cancelled),
                _ = done.changed() => { if *done.borrow() { return Ok(()); } }
            },
        }
    };
    let mut response = tokio::select! {
        biased;
        _ = cancel.wait_for(|value| *value) => return Err(DownloadError::Cancelled),
        result = client.get(&entry.url).send() => result.and_then(|r| r.error_for_status()).map_err(DownloadError::other)?,
    };
    let (file, mut partial) = tempfile::NamedTempFile::new_in(parent)
        .map_err(DownloadError::other)?
        .into_parts();
    let mut writer = tokio::io::BufWriter::new(tokio::fs::File::from_std(file));
    let downloaded = Arc::new(AtomicU64::new(0));
    progress.lock().unwrap().insert(
        entry.path.clone(),
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
    progress.lock().unwrap().remove(&entry.path);
    result?;
    shutdown.map_err(DownloadError::other)?;
    if *cancel.borrow() {
        return Err(DownloadError::Cancelled);
    }
    tokio::fs::rename(&*partial, path)
        .await
        .map_err(DownloadError::other)?;
    partial.disable_cleanup(true);
    owner.published = true;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn owner_failure_releases_waiters_for_retry() {
        let root = tempfile::tempdir().unwrap();
        let directory = StagingDirectory::open(root.path()).unwrap();
        let name = std::ffi::OsStr::new("item");
        let Claim::Owner(owner) = directory.claim(name).unwrap() else {
            panic!()
        };
        let Claim::Waiting(mut done) = directory.claim(name).unwrap() else {
            panic!()
        };
        drop(owner);
        done.changed().await.unwrap();
        assert!(!*done.borrow());
        assert!(matches!(directory.claim(name).unwrap(), Claim::Owner(_)));
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
            .any(|done| done.receiver_count() > 0)
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
        let Claim::Owner(owner) = stage.claim(path.file_name().unwrap()).unwrap() else {
            panic!()
        };
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let entry = DownloadEntry {
            path: path.to_str().unwrap().into(),
            url: format!("http://{}/", listener.local_addr().unwrap()),
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
        let root = tempfile::tempdir().unwrap();
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let path = root.path().join("item");
        let owner = DownloadEntry {
            path: path.to_str().unwrap().into(),
            url: format!("http://{}/", listener.local_addr().unwrap()),
        };
        let waiter = DownloadEntry {
            path: owner.path.clone(),
            url: "invalid-url".into(),
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
            let observer = StagingDirectory::open(root.path()).unwrap();
            let published = async {
                wait_for_competitor(&observer).await;
                socket
                    .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok")
                    .await
                    .unwrap();
            };
            let (result, ()) = tokio::join!(wait, published);
            result
        };
        let (a, b) = tokio::time::timeout(Duration::from_secs(5), async {
            tokio::join!(download_one(&client, &owner, &progress, &mut a), exercise)
        })
        .await
        .unwrap();
        assert!(a.is_ok() && b.is_ok());
        assert_eq!(std::fs::read(path).unwrap(), b"ok");
    }
}
