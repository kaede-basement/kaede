///
/// ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning),
/// but the code here was initially written by me in TypeScript (so this is a rewrite)
///
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        Arc, Mutex, OnceLock, RwLock, RwLockReadGuard,
    },
    time::Duration,
};

use crate::hashing::{to_hex, HashAlgorithm};
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, Manager, ResourceTable, State};
use tokio::{
    io::AsyncWriteExt,
    sync::{watch, OnceCell},
};

static CLIENT: OnceCell<reqwest::Client> = OnceCell::const_new();
type StagingDirectories = Mutex<HashMap<Arc<same_file::Handle>, (Arc<Staging>, usize)>>;
static STAGING: OnceLock<StagingDirectories> = OnceLock::new();

struct Staging {
    directory: OnceLock<tempfile::TempDir>,
    parent: PathBuf,
    transfers: Mutex<HashMap<Arc<same_file::Handle>, Transfer>>,
}

struct Transfer {
    entry: ValidatedEntry,
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
}

impl Owner {
    fn finish(&mut self, published: bool) -> std::io::Result<()> {
        let Some((identity, marker)) = self.marker.take() else {
            return Ok(());
        };
        let mut transfers = self.stage.transfers.lock().unwrap();
        let transfer = transfers.remove(&identity).unwrap();
        drop(identity);
        let removed = marker.close();
        transfer.done.send_replace(published && removed.is_ok());
        removed
    }
}

impl Drop for Owner {
    fn drop(&mut self) {
        if let Err(e) = self.finish(false) {
            log::error!("Cannot retire download marker: {e}");
        }
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
                    directory: OnceLock::new(),
                    parent: parent.to_owned(),
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
    fn claim(&self, name: &std::ffi::OsStr, entry: &ValidatedEntry) -> std::io::Result<Claim> {
        let stage = &self.directory;
        let mut transfers = stage.transfers.lock().unwrap();
        let directory = match stage.directory.get() {
            Some(directory) => directory,
            None => {
                stage
                    .directory
                    .set(tempfile::tempdir_in(&stage.parent)?)
                    .unwrap();
                stage.directory.get().unwrap()
            }
        };
        let path = directory.path().join(name);
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
            let removed = active.remove_entry(&self.parent);
            drop(active);
            drop(removed);
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

#[derive(Clone)]
struct Checksum {
    algorithm: HashAlgorithm,
    hash: String,
}

#[derive(Clone, Default)]
struct ValidatedEntry {
    url: String,
    size: Option<u64>,
    checksum: Option<Checksum>,
}

impl DownloadEntry {
    fn validate(&self) -> Result<ValidatedEntry, DownloadError> {
        let checksum = match (self.algorithm, &self.hash) {
            (Some(algorithm), Some(hash)) => {
                algorithm.validate(hash).map_err(DownloadError::other)?;
                Some(Checksum {
                    algorithm,
                    hash: hash.clone(),
                })
            }
            (None, None) => None,
            _ => return Err(DownloadError::other("Expected both algorithm and hash")),
        };
        Ok(ValidatedEntry {
            url: self.url.clone(),
            size: self.size,
            checksum,
        })
    }
}

impl ValidatedEntry {
    fn same_transfer(&self, other: &Self) -> bool {
        self.url == other.url
            && self.size == other.size
            && match (&self.checksum, &other.checksum) {
                (Some(a), Some(b)) => {
                    a.algorithm == b.algorithm && a.hash.eq_ignore_ascii_case(&b.hash)
                }
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

#[derive(Clone, Debug)]
pub(crate) enum DownloadError {
    Cancelled,
    Integrity(String),
    Other(String),
}

impl DownloadError {
    pub(crate) fn priority(&self) -> u8 {
        match self {
            Self::Cancelled => 0,
            Self::Other(_) => 1,
            Self::Integrity(_) => 2,
        }
    }

    pub(crate) fn install_message(self) -> String {
        match self {
            Self::Cancelled => "Installation cancelled".into(),
            Self::Other(message) | Self::Integrity(message) => message,
        }
    }

    pub(crate) fn other(error: impl ToString) -> Self {
        DownloadError::Other(error.to_string())
    }
}

#[derive(Default, Clone)]
pub struct CancelFlags(Arc<Mutex<HashMap<String, CancelEntry>>>);

#[derive(Default)]
enum InstallPhase {
    #[default]
    Absent,
    Prepared {
        token: u64,
        page: ScopeId,
        window: ScopeId,
    },
    Running(InstallDecision),
}

#[derive(Clone)]
pub(crate) struct CancelSignal {
    receiver: watch::Receiver<bool>,
    publish_gate: Arc<RwLock<bool>>,
}

impl CancelSignal {
    pub(crate) fn publication_permit(&self) -> Result<RwLockReadGuard<'_, bool>, DownloadError> {
        let gate = self.publish_gate.read().unwrap();
        if *gate || *self.borrow() || self.has_changed().is_err() {
            return Err(DownloadError::Cancelled);
        }
        Ok(gate)
    }

    pub(crate) fn channel() -> (watch::Sender<bool>, Self) {
        let (sender, receiver) = watch::channel(false);
        (
            sender,
            Self {
                receiver,
                publish_gate: Arc::default(),
            },
        )
    }
}

impl std::ops::Deref for CancelSignal {
    type Target = watch::Receiver<bool>;
    fn deref(&self) -> &Self::Target {
        &self.receiver
    }
}

impl std::ops::DerefMut for CancelSignal {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.receiver
    }
}

struct CancelEntry {
    flag: watch::Sender<bool>,
    signal: CancelSignal,
    cancel_requested: bool,
    batches: usize,
    install: InstallPhase,
}

impl Default for CancelEntry {
    fn default() -> Self {
        let (flag, signal) = CancelSignal::channel();
        Self {
            flag,
            signal,
            cancel_requested: false,
            batches: 0,
            install: InstallPhase::Absent,
        }
    }
}

pub(crate) struct Registration {
    flags: CancelFlags,
    id: String,
    signal: CancelSignal,
    install: Option<InstallDecision>,
}

impl std::ops::Deref for Registration {
    type Target = CancelSignal;
    fn deref(&self) -> &Self::Target {
        &self.signal
    }
}
impl std::ops::DerefMut for Registration {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.signal
    }
}
impl Drop for Registration {
    fn drop(&mut self) {
        let mut entries = self.flags.0.lock().unwrap();
        let Some(entry) = entries.get_mut(&self.id) else {
            return;
        };
        if !Arc::ptr_eq(&entry.signal.publish_gate, &self.signal.publish_gate) {
            return;
        }
        if let Some(own) = &self.install {
            if matches!(&entry.install, InstallPhase::Running(d) if Arc::ptr_eq(&own.0, &d.0)) {
                // A detached blocking materialization must lose the right to publish.
                own.claim();
                entry.install = InstallPhase::Absent;
            }
        } else {
            entry.batches -= 1;
        }
        if entry.batches == 0 && matches!(entry.install, InstallPhase::Absent) {
            entries.remove(&self.id);
        }
    }
}

#[derive(Clone, PartialEq, Eq)]
struct ScopeId {
    label: String,
    generation: u64,
}

// Tauri keeps a resource table per actual window/webview instance, including
// across handle clones. A replacement with the same label gets its own table.
struct ReservationScope {
    flags: CancelFlags,
    id: ScopeId,
}

impl tauri::Resource for ReservationScope {}

impl ReservationScope {
    fn resource(table: &ResourceTable) -> Option<tauri::ResourceId> {
        table
            .names()
            .find(|(_, name)| name == std::any::type_name::<Self>())
            .map(|(rid, _)| rid)
    }

    fn current(table: &mut ResourceTable, label: &str, flags: &CancelFlags) -> ScopeId {
        if let Some(rid) = Self::resource(table) {
            return table.get::<Self>(rid).unwrap().id.clone();
        }
        static NEXT: AtomicU64 = AtomicU64::new(1);
        let id = ScopeId {
            label: label.into(),
            generation: NEXT.fetch_add(1, Ordering::Relaxed),
        };
        table.add(Self {
            flags: flags.clone(),
            id: id.clone(),
        });
        id
    }
}

pub fn end_reservation_scope(table: &mut ResourceTable) {
    if let Some(rid) = ReservationScope::resource(table) {
        drop(table.take::<ReservationScope>(rid).unwrap());
    }
}

impl Drop for ReservationScope {
    fn drop(&mut self) {
        self.flags.revoke_scope(&self.id);
    }
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
pub fn prepare_mrpack_install(
    webview: tauri::Webview,
    flags: State<CancelFlags>,
    cancel_id: String,
) -> Result<u64, String> {
    static NEXT: AtomicU64 = AtomicU64::new(1);
    let token = NEXT.fetch_add(1, Ordering::Relaxed);
    let page = {
        let window = webview.window_ref();
        let mut window_table = window.resources_table();
        let mut page_table = webview.resources_table();
        let window = ReservationScope::current(&mut window_table, window.label(), &flags);
        let page = ReservationScope::current(&mut page_table, webview.label(), &flags);
        flags.reserve_install(cancel_id, token, page.clone(), window)?;
        page
    };
    // A queued synchronous invoke may still hold the handle of a closed webview.
    let registered = webview
        .window()
        .webviews()
        .into_iter()
        .find(|live| live.label() == webview.label())
        .is_some_and(|live| {
            let table = live.resources_table();
            ReservationScope::resource(&table)
                .is_some_and(|rid| table.get::<ReservationScope>(rid).unwrap().id == page)
        });
    if !registered {
        flags.revoke_scope(&page);
        return Err("Preparing webview closed".into());
    }
    Ok(token)
}

impl CancelFlags {
    fn reserve_install(
        &self,
        id: String,
        token: u64,
        page: ScopeId,
        window: ScopeId,
    ) -> Result<(), String> {
        let mut entries = self.0.lock().unwrap();
        let entry = entries.entry(id).or_default();
        if !matches!(entry.install, InstallPhase::Absent) {
            return Err("Install ID already active".into());
        }
        entry.install = InstallPhase::Prepared {
            token,
            page,
            window,
        };
        Ok(())
    }

    fn revoke_scope(&self, expired: &ScopeId) {
        self.0.lock().unwrap().retain(|_, entry| {
            if matches!(&entry.install, InstallPhase::Prepared {page, window, ..} if page == expired || window == expired) {
                entry.install = InstallPhase::Absent;
                return entry.batches != 0;
            }
            true
        });
    }

    pub(crate) fn bind_install(
        &self,
        id: &str,
        token: Option<u64>,
        table: &ResourceTable,
    ) -> Result<(Registration, InstallDecision), String> {
        let page = ReservationScope::resource(table)
            .and_then(|rid| table.get::<ReservationScope>(rid).ok());
        self.start_install(id, token, page.as_ref().map(|scope| &scope.id))
    }

    fn start_install(
        &self,
        id: &str,
        token: Option<u64>,
        caller: Option<&ScopeId>,
    ) -> Result<(Registration, InstallDecision), String> {
        let mut entries = self.0.lock().unwrap();
        let entry = entries.get_mut(id).ok_or("Unknown install reservation")?;
        let InstallPhase::Prepared {
            token: own,
            ref page,
            ..
        } = entry.install
        else {
            return Err("Install not prepared".into());
        };
        if token.map_or(caller != Some(page), |token| token != own) {
            return Err("Expired install reservation".into());
        }
        let decision = InstallDecision::default();
        if entry.cancel_requested {
            decision.claim();
        }
        entry.install = InstallPhase::Running(decision.clone());
        let registration = Registration {
            flags: self.clone(),
            id: id.into(),
            signal: entry.signal.clone(),
            install: Some(decision.clone()),
        };
        Ok((registration, decision))
    }

    fn begin_cancel_sync(&self, id: &str) -> Option<Arc<RwLock<bool>>> {
        let (flag, gate) = {
            let mut entries = self.0.lock().unwrap();
            let entry = entries.get_mut(id)?;
            if matches!(&entry.install, InstallPhase::Running(d) if !d.claim())
                && entry.batches == 0
            {
                return None;
            }
            // A prepared install can start between releasing the registry and notifying workers.
            entry.cancel_requested = true;
            (entry.flag.clone(), entry.signal.publish_gate.clone())
        };
        flag.send_replace(true);
        Some(gate)
    }

    pub(crate) fn cancel(
        &self,
        id: &str,
    ) -> impl std::future::Future<Output = Result<bool, String>> + Send + 'static {
        let pending = self.begin_cancel_sync(id);
        async move {
            let Some(gate) = pending else {
                return Ok(false);
            };
            tokio::task::spawn_blocking(move || *gate.write().unwrap() = true)
                .await
                .map_err(|e| e.to_string())?;
            Ok(true)
        }
    }

    pub(crate) fn register(&self, id: &str) -> Registration {
        let mut entries = self.0.lock().unwrap();
        let entry = entries.entry(id.into()).or_default();
        entry.batches += 1;
        Registration {
            flags: self.clone(),
            id: id.into(),
            signal: entry.signal.clone(),
            install: None,
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

pub(crate) fn cancel_downloads<R: tauri::Runtime>(
    invoke: &crate::Invoke<R>,
) -> Result<impl std::future::Future<Output = Result<bool, String>>, tauri::ipc::InvokeError> {
    let id: String = crate::argument(invoke, "cancel_downloads", "cancelId")?;
    let flags: State<CancelFlags> = crate::argument(invoke, "cancel_downloads", "state")?;
    Ok(flags.cancel(&id))
}

pub(crate) fn concurrently_download<R: tauri::Runtime>(
    invoke: &crate::Invoke<R>,
) -> Result<
    impl std::future::Future<Output = Result<DownloadReport, String>>,
    tauri::ipc::InvokeError,
> {
    const NAME: &str = "concurrently_download";
    let id: String = crate::argument(invoke, NAME, "cancelId")?;
    let flags: State<CancelFlags> = crate::argument(invoke, NAME, "flags")?;
    let progress = crate::ipc_dispatch::channel(
        invoke,
        NAME,
        "onProgress",
        crate::ipc_dispatch::Delivery::Queued,
    )?;
    let entries = crate::argument(invoke, NAME, "entries")?;
    let concurrency = crate::argument(invoke, NAME, "concurrency")?;
    let label = crate::argument(invoke, NAME, "label")?;
    let debug = crate::argument(invoke, NAME, "debug")?;
    Ok(download_batch(
        flags.register(&id),
        entries,
        concurrency,
        label,
        progress,
        debug,
    ))
}

async fn download_batch(
    cancel: Registration,
    entries: Vec<DownloadEntry>,
    concurrency: usize,
    label: String,
    on_progress: Channel<DownloadSnapshot>,
    debug: bool,
) -> Result<DownloadReport, String> {
    let concurrency = concurrency.max(1).min(entries.len());
    let client = client().await?;
    let entries = Arc::new(entries);
    let next_index = Arc::new(AtomicUsize::new(0));
    let progress: Progress = Arc::default();
    let success = Arc::new(AtomicUsize::new(0));
    let failed = Arc::new(AtomicUsize::new(0));

    // One snapshot per tick for the whole batch
    let mut ticker = tokio::task::JoinSet::new();
    ticker.spawn({
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

    let mut workers = tokio::task::JoinSet::new();

    for _ in 0..concurrency {
        let label = label.clone();
        let entries = Arc::clone(&entries);
        let next_index = Arc::clone(&next_index);
        let progress = Arc::clone(&progress);
        let success = Arc::clone(&success);
        let failed = Arc::clone(&failed);
        let mut cancel = cancel.clone();

        workers.spawn(async move {
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
                    Err(DownloadError::Integrity(error) | DownloadError::Other(error)) => {
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
        });
    }

    let mut failures: Vec<FailedDownload> = Vec::new();

    while let Some(worker) = workers.join_next().await {
        match worker {
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

    ticker.shutdown().await;

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
    cancel: &mut CancelSignal,
) -> Result<(), DownloadError> {
    let transfer = entry.validate()?;
    let path = PathBuf::from(&entry.path);
    let client = client.clone();
    let progress = progress.clone();
    supervise(cancel, None, move |mut local| async move {
        staged_transfer(&client, transfer, path, &progress, &mut local).await
    })
    .await
    .map_err(DownloadError::other)?
}

#[derive(Clone)]
pub(crate) struct TransferStop {
    user: CancelSignal,
    siblings: Option<watch::Receiver<bool>>,
    abandoned: watch::Receiver<()>,
}

impl TransferStop {
    pub(crate) async fn cancelled(&mut self) {
        tokio::select! {
            _ = self.user.wait_for(|v| *v) => (),
            _ = self.abandoned.changed() => (),
            _ = async {
                match &mut self.siblings {
                    Some(stop) => { let _ = stop.wait_for(|v| *v).await; }
                    None => std::future::pending().await,
                }
            } => (),
        }
    }

    fn publication_permit(&self) -> Result<RwLockReadGuard<'_, bool>, DownloadError> {
        let gate = self.user.publication_permit()?;
        if self.abandoned.has_changed().is_err()
            || self
                .siblings
                .as_ref()
                .is_some_and(|s| *s.borrow() || s.has_changed().is_err())
        {
            return Err(DownloadError::Cancelled);
        }
        Ok(gate)
    }

    fn publish(&self, partial: tempfile::TempPath, path: &Path) -> Result<(), DownloadError> {
        let _permit = self.publication_permit()?;
        crate::file_system::persist_temp_path(partial, path, true).map_err(DownloadError::other)
    }
}

// The supervisor owns the sender until completion. Dropping it wakes the
// worker, which retains its claim through blocking retirement.
pub(crate) async fn supervise<F, T>(
    user: &CancelSignal,
    siblings: Option<&watch::Receiver<bool>>,
    work: impl FnOnce(TransferStop) -> F,
) -> Result<T, tokio::task::JoinError>
where
    F: std::future::Future<Output = T> + Send + 'static,
    T: Send + 'static,
{
    let (_owner, abandoned) = watch::channel(());
    tokio::spawn(work(TransferStop {
        user: user.clone(),
        siblings: siblings.cloned(),
        abandoned,
    }))
    .await
}

async fn staged_transfer(
    client: &reqwest::Client,
    entry: ValidatedEntry,
    path: PathBuf,
    progress: &Progress,
    cancel: &mut TransferStop,
) -> Result<(), DownloadError> {
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."))
        .to_owned();
    let name = path
        .file_name()
        .ok_or_else(|| DownloadError::other("Missing destination filename"))?
        .to_owned();
    let stop = cancel.clone();
    let mut staging = tokio::task::spawn_blocking(move || {
        {
            let _permit = stop.publication_permit()?;
            std::fs::create_dir_all(&parent).map_err(DownloadError::other)?;
        }
        StagingDirectory::open(&parent).map_err(DownloadError::other)
    })
    .await
    .map_err(DownloadError::other)??;
    let result = loop {
        let name = name.clone();
        let expected = entry.clone();
        let (directory, claim) = tokio::task::spawn_blocking(move || {
            let claim = staging.claim(&name, &expected);
            (staging, claim)
        })
        .await
        .map_err(DownloadError::other)?;
        staging = directory;
        match claim {
            Err(e) => break Err(DownloadError::other(e)),
            Ok(Claim::Owner(mut owner)) => {
                let hash = entry
                    .checksum
                    .as_ref()
                    .map(|c| (c.algorithm, c.hash.as_str()));
                let result = stream_file(
                    client,
                    &entry.url,
                    &path,
                    entry.size,
                    hash.as_slice(),
                    progress,
                    cancel,
                )
                .await;
                let published = result.is_ok();
                tokio::task::spawn_blocking(move || {
                    let removed = owner.finish(published);
                    drop((owner, staging));
                    removed
                })
                .await
                .map_err(DownloadError::other)?
                .map_err(DownloadError::other)?;
                return result;
            }
            Ok(Claim::Waiting { mut done, matches }) => tokio::select! {
                biased;
                _ = cancel.cancelled() => break Err(DownloadError::Cancelled),
                _ = done.changed() => if *done.borrow() {
                    break if matches { Ok(()) } else { Err(DownloadError::other(format!("A different URL or integrity expectation was published for {}", path.display()))) }
                }
            },
        }
    };
    tokio::task::spawn_blocking(move || drop(staging))
        .await
        .map_err(DownloadError::other)?;
    result
}

pub(crate) async fn stream_file(
    client: &reqwest::Client,
    url: &str,
    path: &Path,
    size: Option<u64>,
    hashes: &[(HashAlgorithm, &str)],
    progress: &Progress,
    cancel: &mut TransferStop,
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
        _ = cancel.cancelled() => return Err(DownloadError::Cancelled),
        result = client.get(url).send() => result.and_then(|r| r.error_for_status()).map_err(DownloadError::other)?,
    };
    let parent = parent.to_owned();
    let (file, partial) =
        tokio::task::spawn_blocking(move || crate::file_system::staging_file(&parent))
            .await
            .map_err(DownloadError::other)?
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
                _ = cancel.cancelled() => return Err(DownloadError::Cancelled),
                result = response.chunk() => result.map_err(DownloadError::other)?,
            };
            let Some(chunk) = chunk else { break };
            if size.is_some_and(|limit| {
                downloaded
                    .load(Ordering::Relaxed)
                    .saturating_add(chunk.len() as u64)
                    > limit
            }) {
                return Err(DownloadError::Integrity(format!(
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
    let path = path.to_owned();
    let cancel = cancel.clone();
    let verified = (|| {
        result?;
        shutdown.map_err(DownloadError::other)?;
        if size.is_some_and(|size| size != downloaded.load(Ordering::Relaxed)) {
            return Err(DownloadError::Integrity(format!(
                "Size mismatch for {}",
                path.display()
            )));
        }
        for (expected, hasher) in hashers {
            if !to_hex(&hasher.finalize()).eq_ignore_ascii_case(expected) {
                return Err(DownloadError::Integrity(format!(
                    "Hash mismatch for {}",
                    path.display()
                )));
            }
        }
        Ok(())
    })();
    tokio::task::spawn_blocking(move || {
        verified?;
        cancel.publish(partial, &path)
    })
    .await
    .map_err(DownloadError::other)?
}

#[cfg(test)]
pub(crate) mod mock_http {
    use tokio::{
        io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
        net::{TcpListener, TcpStream},
    };

    pub async fn accept_request(listener: &TcpListener) -> (TcpStream, String) {
        let (socket, _) = listener.accept().await.unwrap();
        let mut reader = BufReader::new(socket);
        let mut request_line = String::new();
        reader.read_line(&mut request_line).await.unwrap();
        let mut header = Vec::new();
        loop {
            header.clear();
            if reader.read_until(b'\n', &mut header).await.unwrap() == 0 || header == b"\r\n" {
                break;
            }
        }
        (reader.into_inner(), request_line)
    }

    pub async fn respond(mut socket: TcpStream, response: &[u8]) {
        socket.write_all(response).await.unwrap();
        socket.shutdown().await.unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::mock_http::{accept_request, respond};
    use super::*;
    fn scope(generation: u64) -> ScopeId {
        ScopeId {
            label: "main".into(),
            generation,
        }
    }

    #[test]
    fn navigation_and_destruction_retire_only_their_instances() {
        let flags = CancelFlags::default();
        let mut page = ResourceTable::default();
        let mut window = ResourceTable::default();
        let owner = ReservationScope::current(&mut window, "main", &flags);
        let prepared = ReservationScope::current(&mut page, "main", &flags);
        flags
            .reserve_install("pack".into(), 1, prepared, owner.clone())
            .unwrap();
        end_reservation_scope(&mut page);
        assert!(flags.start_install("pack", None, None).is_err());

        let reopened = ReservationScope::current(&mut page, "main", &flags);
        flags
            .reserve_install("pack".into(), 2, reopened, owner)
            .unwrap();
        end_reservation_scope(&mut window);
        assert!(flags.start_install("pack", Some(2), None).is_err());

        let mut next_page = ResourceTable::default();
        let next = ReservationScope::current(&mut next_page, "main", &flags);
        let owner = ReservationScope::current(&mut window, "main", &flags);
        flags
            .reserve_install("pack".into(), 3, next, owner)
            .unwrap();
        assert!(flags.bind_install("pack", None, &page).is_err());
        drop(page);
        assert!(flags.start_install("pack", Some(2), None).is_err());
        assert!(flags.bind_install("pack", None, &next_page).is_ok());
    }

    #[tokio::test]
    async fn deferred_cancel_completion_is_bound_to_original_registration() {
        let flags = CancelFlags::default();
        let original = flags.register("shared");
        let completion = flags.cancel("shared");
        assert!(*original.borrow());
        drop(original);
        let replacement = flags.register("shared");
        assert!(completion.await.unwrap());
        assert!(!*replacement.borrow());
        assert!(!*replacement.publish_gate.read().unwrap());
    }

    #[tokio::test]
    async fn prepared_cancel_and_page_revocation_preserve_shared_registrations() {
        let flags = CancelFlags::default();
        let batch = flags.register("shared");
        flags
            .reserve_install("shared".into(), 1, scope(1), scope(10))
            .unwrap();
        assert!(flags.cancel("shared").await.unwrap());
        let (run, decision) = flags.start_install("shared", Some(1), None).unwrap();
        assert!(*run.borrow() && *batch.borrow());
        assert!(!decision.claim());
        drop((run, batch));
        flags
            .reserve_install("shared".into(), 2, scope(2), scope(10))
            .unwrap();
        flags.revoke_scope(&scope(2));
        flags
            .reserve_install("shared".into(), 3, scope(3), scope(10))
            .unwrap();
        flags.revoke_scope(&scope(2));
        assert!(flags.start_install("shared", Some(2), None).is_err());
        let (run, decision) = flags.start_install("shared", Some(3), None).unwrap();
        assert!(!*run.borrow());
        drop(run);
        assert!(!decision.claim());
        flags
            .reserve_install("shared".into(), 4, scope(4), scope(10))
            .unwrap();
        let (run, published) = flags
            .start_install("shared", None, Some(&scope(4)))
            .unwrap();
        let sibling = flags.register("shared");
        assert!(published.claim());
        assert!(flags.cancel("shared").await.unwrap());
        assert!(*sibling.borrow());
        drop((run, sibling));
        assert!(flags.0.lock().unwrap().is_empty());
    }

    #[tokio::test(flavor = "current_thread")]
    async fn cancellation_wakes_siblings_before_waiting_for_an_admitted_rename() {
        let flags = CancelFlags::default();
        let owner = flags.register("group");
        let mut sibling = flags.register("group");
        let (ready, entered) = tokio::sync::oneshot::channel();
        let (release, wait) = std::sync::mpsc::channel();
        let rename = supervise(&owner, None, move |stop| async move {
            tokio::task::spawn_blocking(move || {
                let _permit = stop.publication_permit().unwrap();
                ready.send(()).unwrap();
                wait.recv_timeout(Duration::from_secs(5)).unwrap();
            })
            .await
            .unwrap();
        });
        tokio::pin!(rename);
        tokio::select! { _ = &mut rename => panic!("publication finished early"), result = entered => result.unwrap() }
        let cancelling = flags.cancel("group");
        tokio::pin!(cancelling);
        tokio::time::timeout(Duration::from_secs(3), async {
            tokio::select! {
                biased;
                _ = &mut cancelling => panic!("cancel acknowledged an unfinished rename"),
                changed = sibling.wait_for(|cancelled| *cancelled) => assert!(*changed.unwrap()),
            }
            tokio::spawn(async {}).await.unwrap();
            assert!(futures_util::poll!(&mut cancelling).is_pending());
            release.send(()).unwrap();
            assert!(cancelling.await.unwrap());
            rename.await.unwrap();
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn acknowledged_cancel_prevents_creation_of_download_parent() {
        let root = tempfile::tempdir().unwrap();
        let parent = root.path().join("missing");
        let dest = parent.join("file");
        let flags = CancelFlags::default();
        let registration = flags.register("download");
        let (ready, paused) = tokio::sync::oneshot::channel();
        let (resume, wait) = tokio::sync::oneshot::channel();
        let worker = supervise(&registration, None, move |mut stop| async move {
            let client = client().await.unwrap();
            ready.send(()).unwrap();
            wait.await.unwrap();
            staged_transfer(
                client,
                ValidatedEntry::default(),
                dest,
                &Progress::default(),
                &mut stop,
            )
            .await
        });
        let (result, ()) = tokio::join!(worker, async {
            paused.await.unwrap();
            assert!(flags.cancel("download").await.unwrap());
            resume.send(()).unwrap();
        });
        assert!(matches!(result.unwrap(), Err(DownloadError::Cancelled)));
        assert!(!parent.exists());
    }

    #[tokio::test]
    async fn paused_supervisor_cannot_publish_after_accepted_cancel() {
        let root = tempfile::tempdir().unwrap();
        let target = root.path().join("download");
        std::fs::write(&target, b"original").unwrap();
        let mut staged = crate::file_system::staging_file(root.path()).unwrap();
        std::io::Write::write_all(&mut staged, b"downloaded").unwrap();
        let flags = CancelFlags::default();
        let registration = flags.register("user");
        let (ready, at_publication) = tokio::sync::oneshot::channel();
        let (release, wait) = tokio::sync::oneshot::channel();
        let (done, finished) = tokio::sync::oneshot::channel();
        let path = target.clone();
        let supervisor = supervise(&registration, None, move |stop| async move {
            ready.send(()).unwrap();
            wait.await.unwrap();
            let result =
                tokio::task::spawn_blocking(move || stop.publish(staged.into_temp_path(), &path))
                    .await
                    .unwrap();
            done.send(result).unwrap();
        });
        tokio::pin!(supervisor);
        assert!(futures_util::poll!(&mut supervisor).is_pending());
        at_publication.await.unwrap();
        assert!(flags.cancel("user").await.unwrap());
        release.send(()).unwrap();
        // No poll of the supervisor between cancellation and this publication attempt.
        assert!(matches!(
            finished.await.unwrap(),
            Err(DownloadError::Cancelled)
        ));
        supervisor.await.unwrap();
        assert_eq!(std::fs::read(target).unwrap(), b"original");
        assert_eq!(root.path().read_dir().unwrap().count(), 1);
    }

    #[tokio::test]
    async fn cancel_binds_before_registered_download_is_polled() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("item");
        let entry = DownloadEntry {
            path: target.display().to_string(),
            ..Default::default()
        };
        let flags = CancelFlags::default();
        let start = download_batch(
            flags.register("batch"),
            vec![entry],
            1,
            "test".into(),
            Channel::new(|_| Ok(())),
            false,
        );
        assert!(flags.cancel("batch").await.unwrap());
        let report = start.await.unwrap();
        assert!(report.cancelled);
        assert_eq!((report.success, report.failed), (0, 0));
        assert!(!target.exists());
    }

    #[tokio::test]
    async fn malformed_checksum_fails_only_its_item() {
        let dir = tempfile::tempdir().unwrap();
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let good = DownloadEntry {
            path: dir.path().join("good").display().to_string(),
            url: format!("http://{}", listener.local_addr().unwrap()),
            ..Default::default()
        };
        let bad = DownloadEntry {
            path: dir.path().join("absent/bad").display().to_string(),
            algorithm: Some(HashAlgorithm::Sha1),
            ..good.clone()
        };
        let flags = CancelFlags::default();
        let (report, ()) = tokio::join!(
            download_batch(
                flags.register("id"),
                vec![bad, good],
                2,
                "test".into(),
                Channel::new(|_| Ok(())),
                false
            ),
            async {
                let (socket, _) = accept_request(&listener).await;
                respond(socket, b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok").await;
            }
        );
        let report = report.unwrap();
        assert_eq!((report.success, report.failed), (1, 1));
        assert!(report.failures[0].error.contains("both"));
        assert!(!dir.path().join("absent").exists());
        assert_eq!(std::fs::read(dir.path().join("good")).unwrap(), b"ok");
    }

    #[tokio::test]
    async fn abandoned_body_retires_aliased_claim_before_retry() {
        let root = tempfile::tempdir().unwrap();
        std::fs::create_dir(root.path().join("sub")).unwrap();
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let entry = DownloadEntry {
            path: root.path().join("item").display().to_string(),
            url: format!("http://{}", listener.local_addr().unwrap()),
            ..Default::default()
        };
        let alias = DownloadEntry {
            path: root.path().join("sub/../item").display().to_string(),
            ..entry.clone()
        };
        let client = reqwest::Client::new();
        let progress = Progress::default();
        let (_tx, mut cancel) = CancelSignal::channel();
        let mut first_cancel = cancel.clone();
        let mut first = Box::pin(download_one(&client, &entry, &progress, &mut first_cancel));
        tokio::time::timeout(Duration::from_secs(5), async {
            let mut stalled = tokio::select! {
                _ = &mut first => panic!("unexpected completion"),
                (socket, _) = accept_request(&listener) => socket,
            };
            stalled.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 10000\r\n\r\nx").await.unwrap();
            while !progress.lock().unwrap().values().any(|p| p.downloaded.load(Ordering::Relaxed) == 1) { tokio::task::yield_now().await; }
            let staging = StagingDirectory::open(root.path()).unwrap();
            let mut retry = Box::pin(download_one(&client, &alias, &progress, &mut cancel));
            tokio::select! { _ = &mut retry => panic!("alias skipped owner"), _ = wait_for_competitor(&staging) => {} }
            drop(first);
            let (result, ()) = tokio::join!(retry, async {
                let (socket, _) = accept_request(&listener).await;
                respond(socket,b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok").await;
            });
            result.unwrap();
        }).await.unwrap();
        assert!(progress.lock().unwrap().is_empty());
        assert_eq!(std::fs::read(root.path().join("item")).unwrap(), b"ok");
        assert_eq!(root.path().read_dir().unwrap().count(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn cancellation_and_publication_have_one_winner() {
        let runtime = tokio::runtime::Handle::current();
        let root = tempfile::tempdir().unwrap();
        let flags = CancelFlags::default();
        for _ in 0..16 {
            let stage = tempfile::tempdir_in(root.path()).unwrap();
            let target = root.path().join("instance");
            flags
                .reserve_install("install".into(), 1, scope(1), scope(10))
                .unwrap();
            let (registration, decision) = flags.start_install("install", Some(1), None).unwrap();
            let barrier = std::sync::Barrier::new(2);
            std::thread::scope(|scope| {
                let cancel = scope.spawn(|| {
                    barrier.wait();
                    runtime.block_on(flags.cancel("install")).unwrap()
                });
                barrier.wait();
                let published = decision.publish(stage.path(), &target).is_ok();
                assert_eq!(cancel.join().unwrap(), !published);
                assert_eq!(target.exists(), published);
            });
            drop(registration);
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
            let (_tx, mut cancel) = CancelSignal::channel();
            let progress = Progress::default();
            let client = reqwest::Client::builder().no_proxy().build().unwrap();
            let (result, ()) = tokio::join!(
                download_one(&client, &entry, &progress, &mut cancel),
                async {
                    let (socket, _) = accept_request(&listener).await;
                    respond(socket, b"HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nbad").await;
                }
            );
            assert!(matches!(result,Err(DownloadError::Integrity(e)) if e.contains("mismatch")));
            assert_eq!(std::fs::read(&path).unwrap(), b"original");
            assert_eq!(dir.path().read_dir().unwrap().count(), 1);
        }
    }

    #[tokio::test]
    async fn owner_failure_releases_waiters_for_retry() {
        let root = tempfile::tempdir().unwrap();
        let directory = StagingDirectory::open(root.path()).unwrap();
        let name = std::ffi::OsStr::new("item");
        let Claim::Owner(owner) = directory.claim(name, &ValidatedEntry::default()).unwrap() else {
            panic!()
        };
        let Claim::Waiting { mut done, .. } =
            directory.claim(name, &ValidatedEntry::default()).unwrap()
        else {
            panic!()
        };
        drop(owner);
        done.changed().await.unwrap();
        assert!(!*done.borrow());
        assert!(matches!(
            directory.claim(name, &ValidatedEntry::default()).unwrap(),
            Claim::Owner(_)
        ));
    }
    #[tokio::test]
    async fn cancellation_wakes_all_registered_batches_and_resets() {
        let flags = CancelFlags::default();
        let mut a = flags.register("shared");
        let mut b = flags.register("shared");
        flags.0.lock().unwrap()["shared"].flag.send_replace(true);
        a.changed().await.unwrap();
        b.changed().await.unwrap();
        assert!(*b.borrow());
        drop((a, b));
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
                let (mut socket, _) = accept_request(&listener).await;
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
        let Claim::Owner(owner) = stage
            .claim(path.file_name().unwrap(), &entry.validate().unwrap())
            .unwrap()
        else {
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
                    let (socket, _) = accept_request(&listener).await;
                    respond(socket, b"HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nnew").await;
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
                let (socket, _) = accept_request(&listener).await;
                let wait = download_one(&client, &waiter, &progress, &mut b);
                tokio::pin!(wait);
                let response = b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok";
                let observer = StagingDirectory::open(root.path()).unwrap();
                let (result, ()) = tokio::join!(wait, async {
                    wait_for_competitor(&observer).await;
                    if owner_fails {
                        respond(socket, b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
                        let (retry, _) = accept_request(&listener).await;
                        respond(retry, response).await;
                    } else {
                        respond(socket, response).await;
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
