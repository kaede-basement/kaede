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
type StagingDirectories = Mutex<HashMap<Arc<same_file::Handle>, (Arc<tempfile::TempDir>, usize)>>;
static STAGING: OnceLock<StagingDirectories> = OnceLock::new();

struct StagingDirectory {
    parent: Arc<same_file::Handle>,
    directory: Arc<tempfile::TempDir>,
}

impl StagingDirectory {
    fn open(parent: &Path) -> std::io::Result<Self> {
        let parent_id = Arc::new(same_file::Handle::from_path(parent)?);
        let mut active = STAGING.get_or_init(Default::default).lock().unwrap();
        let (dir, owners) = match active.entry(parent_id.clone()) {
            std::collections::hash_map::Entry::Occupied(entry) => entry.into_mut(),
            std::collections::hash_map::Entry::Vacant(entry) => {
                entry.insert((Arc::new(tempfile::tempdir_in(parent)?), 0))
            }
        };
        *owners += 1;
        let directory = dir.clone();
        Ok(Self {
            parent: parent_id,
            directory,
        })
    }

    // create_new lets the destination filesystem decide whether two names alias.
    fn claim(&self, name: &std::ffi::OsStr) -> std::io::Result<tempfile::NamedTempFile> {
        let path = self.directory.path().join(name);
        let file = std::fs::File::options()
            .write(true)
            .create_new(true)
            .open(&path)?;
        Ok(tempfile::NamedTempFile::from_parts(
            file,
            tempfile::TempPath::from_path(path),
        ))
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
    let (_staging, partial) = tokio::task::spawn_blocking(move || {
        let name = path
            .file_name()
            .ok_or_else(|| DownloadError::other("Missing destination filename"))?;
        let parent = path
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
        std::fs::create_dir_all(parent).map_err(DownloadError::other)?;
        let staging = StagingDirectory::open(parent).map_err(DownloadError::other)?;
        let partial = staging.claim(name).map_err(DownloadError::other)?;
        Ok::<_, DownloadError>((staging, partial))
    })
    .await
    .map_err(DownloadError::other)??;

    let mut response = tokio::select! {
        biased;
        _ = cancel.wait_for(|value| *value) => return Err(DownloadError::Cancelled),
        result = client.get(&entry.url).send() => result.and_then(|r| r.error_for_status()).map_err(DownloadError::other)?,
    };
    let (file, partial) = partial.into_parts();
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
        writer.flush().await.map_err(DownloadError::other)?;
        Ok(())
    }
    .await;
    drop(writer);
    progress.lock().unwrap().remove(&entry.path);
    result?;
    if *cancel.borrow() {
        return Err(DownloadError::Cancelled);
    }
    partial.persist(&entry.path).map_err(DownloadError::other)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn destination_has_one_owner_until_release() {
        let root = tempfile::tempdir().unwrap();
        let first = StagingDirectory::open(root.path()).unwrap();
        let second = StagingDirectory::open(root.path()).unwrap();
        let name = std::ffi::OsStr::new("test.jar");
        let owner = first.claim(name).unwrap();
        assert!(second.claim(name).is_err());
        drop(owner);
        assert!(second.claim(name).is_ok());
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
                let mut competing = flags.register("other");
                assert!(matches!(
                    download_one(&client, &entry, &Progress::default(), &mut competing).await,
                    Err(DownloadError::Other(_))
                ));
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
}
