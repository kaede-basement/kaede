use same_file::Handle;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
///
/// ATTENTION: AI-generated (by Qwen 3.8-Max and Claude Fable 5 on 'max' reasoning)
///
use std::{
    collections::VecDeque,
    fs::File,
    io::{self, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{ipc::Channel, Listener, Manager, ResourceTable, State};
use tokio::sync::watch;
const TICK: Duration = Duration::from_millis(100);

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
pub enum LogStreamEvent {
    Snapshot(Vec<String>),
    Lines(Vec<String>),
    Truncated,
}

pub struct LogTail {
    path: PathBuf,
    last_issued: Mutex<u64>,
    retention_enabled: AtomicBool,
    logged_bytes: Mutex<u64>,
}

const MAX_SAFE_ID: u64 = (1 << 53) - 1;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Viewer {
    Legacy(Option<u64>),
    Token(u64),
}

impl Viewer {
    fn from_args(subscription_id: Option<u64>, token: Option<u64>) -> Self {
        token.map_or(Self::Legacy(subscription_id), Self::Token)
    }
}

#[derive(Default)]
struct LogWindow(Mutex<Subscription>);
impl tauri::Resource for LogWindow {}

impl LogWindow {
    fn stop(&self, viewer: Viewer) -> impl std::future::Future<Output = bool> + 'static {
        let (stopped, sending) = {
            let mut current = self.0.lock().unwrap();
            let stopped = current.stop(viewer);
            (
                stopped,
                current
                    .sending
                    .clone()
                    .filter(|s| stopped || s.viewer == viewer),
            )
        };
        async move {
            if let Some(sending) = sending {
                drop(sending.send.lock().await);
            }
            stopped
        }
    }

    fn resource(table: &ResourceTable) -> Option<tauri::ResourceId> {
        table
            .names()
            .find(|(_, name)| name == std::any::type_name::<Self>())
            .map(|(id, _)| id)
    }
}

pub fn page_changed(table: &mut ResourceTable, destroyed: bool) {
    let mut next = Subscription::default();
    if let Some(old) = LogWindow::resource(table).and_then(|id| table.take::<LogWindow>(id).ok()) {
        let mut old = old.0.lock().unwrap();
        old.retired = true;
        if let Some(active) = old.active.take() {
            old.remember(active.viewer);
        }
        next.stopped_legacy = std::mem::take(&mut old.stopped_legacy);
        next.sending = old.sending.clone();
    }
    if !destroyed {
        table.add(LogWindow(Mutex::new(next)));
    }
}

#[derive(Default)]
struct Subscription {
    retired: bool,
    generation: u64,
    active: Option<ActiveViewer>,
    sending: Option<ActiveViewer>,
    // Consecutive IDs issued to one window share a range until a start or stop consumes them.
    pending_issued: VecDeque<(u64, u64)>,
    stopped_legacy: VecDeque<u64>,
}

#[derive(Clone)]
struct ActiveViewer {
    send: Arc<tokio::sync::Mutex<()>>,
    generation: u64,
    viewer: Viewer,
}

impl Subscription {
    fn issue(&mut self, id: u64) {
        if let Some((_, end)) = self.pending_issued.back_mut() {
            if *end + 1 == id {
                *end = id;
                return;
            }
        }
        self.pending_issued.push_back((id, id));
    }

    fn consume_issued(&mut self, id: u64) -> bool {
        let index = self.pending_issued.partition_point(|&(_, end)| end < id);
        let Some(&(start, end)) = self.pending_issued.get(index) else {
            return false;
        };
        if id < start {
            return false;
        }
        self.pending_issued.drain(..=index);
        if id < end {
            self.pending_issued.push_front((id + 1, end));
        }
        true
    }

    fn remove_issued(&mut self, id: u64) {
        let index = self.pending_issued.partition_point(|&(_, end)| end < id);
        let Some(&(start, end)) = self.pending_issued.get(index) else {
            return;
        };
        if id < start {
            return;
        }
        self.pending_issued.remove(index);
        if id < end {
            self.pending_issued.insert(index, (id + 1, end));
        }
        if start < id {
            self.pending_issued.insert(index, (start, id - 1));
        }
    }

    fn remember(&mut self, viewer: Viewer) {
        if let Viewer::Legacy(Some(id)) = viewer {
            if !self.stopped_legacy.contains(&id) {
                const RECENT: usize = 64;
                if self.stopped_legacy.len() == RECENT {
                    self.stopped_legacy.pop_front();
                }
                self.stopped_legacy.push_back(id);
            }
        }
    }
    fn begin(&mut self, viewer: Viewer) -> Option<u64> {
        if self.retired {
            return None;
        }
        if let Viewer::Token(id) = viewer {
            if !self.consume_issued(id) {
                return None;
            }
        } else if matches!(viewer, Viewer::Legacy(Some(id)) if self.stopped_legacy.contains(&id))
            || self.active.as_ref().is_some_and(|a| match a.viewer {
                Viewer::Token(_) => true,
                Viewer::Legacy(Some(_)) => viewer == Viewer::Legacy(None) || viewer == a.viewer,
                Viewer::Legacy(None) => false,
            })
        {
            return None;
        }
        if let Some(old) = self.active.take() {
            self.remember(old.viewer);
        }
        self.generation += 1;
        self.active = Some(ActiveViewer {
            generation: self.generation,
            viewer,
            send: Arc::default(),
        });
        Some(self.generation)
    }

    fn stop(&mut self, viewer: Viewer) -> bool {
        self.remember(viewer);
        if let Viewer::Token(id) = viewer {
            self.remove_issued(id);
        }
        if self.active.as_ref().is_some_and(|a| a.viewer == viewer) {
            self.active = None;
            true
        } else {
            false
        }
    }
}

struct ActiveSubscription {
    window: Arc<LogWindow>,
    generation: u64,
}

impl Drop for ActiveSubscription {
    fn drop(&mut self) {
        let mut current = self.window.0.lock().unwrap();
        if current.generation == self.generation {
            current.active = None;
        }
    }
}

impl LogTail {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            last_issued: Default::default(),
            retention_enabled: Default::default(),
            logged_bytes: Default::default(),
        }
    }
}

#[derive(Default)]
struct Cursor {
    identity: Option<Handle>,
    offset: u64,
    partial: Vec<u8>,
    started: bool,
}

const CHUNK: usize = 64 * 1024;

impl Cursor {
    fn poll(&mut self, path: &Path) -> io::Result<(Vec<LogStreamEvent>, bool)> {
        let handle = match File::open(path).and_then(Handle::from_file) {
            Ok(handle) => Some(handle),
            Err(e) if e.kind() == io::ErrorKind::NotFound => None,
            Err(e) => return Err(e),
        };
        let length = match &handle {
            Some(h) => h.as_file().metadata()?.len(),
            None => 0,
        };
        let mut events = Vec::new();
        if self.identity.is_some() && (self.identity != handle || length < self.offset) {
            self.offset = 0;
            self.partial.clear();
            events.push(LogStreamEvent::Truncated);
        }
        self.identity = handle;
        let mut lines = Vec::new();
        if length > self.offset {
            let file = self.identity.as_mut().unwrap().as_file_mut();
            file.seek(SeekFrom::Start(self.offset))?;
            let mut bytes = [0; CHUNK];
            let n = file.read(&mut bytes)?;
            self.offset += n as u64;
            for part in bytes[..n].split_inclusive(|b| *b == b'\n') {
                let (mut rest, complete) = match part.strip_suffix(b"\n") {
                    Some(line) => (line, true),
                    None => (part, false),
                };
                while self.partial.len() + rest.len() > CHUNK {
                    let take = CHUNK - self.partial.len();
                    self.partial.extend_from_slice(&rest[..take]);
                    rest = &rest[take..];
                    // Keep a split UTF-8 character for the next chunk.
                    let mut end = CHUNK;
                    if rest[0] & 0xc0 == 0x80 {
                        while end > CHUNK - 3 && self.partial[end - 1] & 0xc0 == 0x80 {
                            end -= 1;
                        }
                        if end > 0 && self.partial[end - 1] >= 0xc2 {
                            end -= 1;
                        } else {
                            end = CHUNK;
                        }
                    }
                    lines.push(String::from_utf8_lossy(&self.partial[..end]).into_owned());
                    self.partial.drain(..end);
                }
                self.partial.extend_from_slice(rest);
                if complete {
                    let line = self.partial.strip_suffix(b"\r").unwrap_or(&self.partial);
                    lines.push(String::from_utf8_lossy(line).into_owned());
                    self.partial.clear();
                }
            }
        }
        if !self.started {
            events.push(LogStreamEvent::Snapshot(lines));
            self.started = true;
        } else if !lines.is_empty() {
            events.push(LogStreamEvent::Lines(lines));
        }
        Ok((events, self.offset < length))
    }
}

struct WebviewLifetime(watch::Receiver<()>);
impl tauri::Resource for WebviewLifetime {}

impl WebviewLifetime {
    fn for_caller<R: tauri::Runtime>(view: &tauri::Webview<R>) -> Option<watch::Receiver<()>> {
        let mut table = view.resources_table();
        let existing = table
            .names()
            .find(|(_, name)| name == std::any::type_name::<Self>())
            .map(|(id, _)| id);
        let (id, lifetime, listener) = match existing {
            Some(id) => (id, table.get::<Self>(id).ok()?, None),
            None => {
                let (open, closed) = watch::channel(());
                let lifetime = Arc::new(Self(closed));
                let id = table.add_arc(lifetime.clone());
                // Tauri removes the webview's listeners even when its parent window survives.
                let listener = view.listen("tauri://destroyed", move |_| {
                    let _ = &open;
                });
                (id, lifetime, Some(listener))
            }
        };
        drop(table);
        let live = view.window().webviews().into_iter().any(|live| {
            live.label() == view.label()
                && live
                    .resources_table()
                    .get::<Self>(id)
                    .is_ok_and(|owner| Arc::ptr_eq(&owner, &lifetime))
        });
        if !live {
            if let Some(listener) = listener {
                view.unlisten(listener);
            }
            return None;
        }
        Some(lifetime.0.clone())
    }
}

pub struct LogCaller(Option<Arc<LogWindow>>);

impl<R: tauri::Runtime> tauri::ipc::CommandArg<'_, R> for LogCaller {
    fn from_command(item: tauri::ipc::CommandItem<'_, R>) -> Result<Self, tauri::ipc::InvokeError> {
        let window = item.message.webview_ref().window_ref();
        let table = window.resources_table();
        Ok(Self(
            LogWindow::resource(&table).and_then(|id| table.get(id).ok()),
        ))
    }
}

#[tauri::command]
pub fn next_log_subscription_id(
    window: LogCaller,
    state: State<'_, Arc<LogTail>>,
) -> Result<u64, String> {
    state.issue_viewer_id(&window.0.ok_or("Window closed")?)
}

fn bind_viewer<R: tauri::Runtime>(
    invoke: &crate::Invoke<R>,
    name: &'static str,
) -> Result<(LogCaller, Viewer), tauri::ipc::InvokeError> {
    let caller = crate::argument(invoke, name, "window")?;
    let legacy = crate::argument(invoke, name, "subscriptionId")?;
    let token = crate::argument(invoke, name, "token")?;
    Ok((caller, Viewer::from_args(legacy, token)))
}

pub(crate) fn stop_log_stream<R: tauri::Runtime>(
    invoke: &crate::Invoke<R>,
) -> Result<impl std::future::Future<Output = Result<bool, String>>, tauri::ipc::InvokeError> {
    let (caller, viewer) = bind_viewer(invoke, "stop_log_stream")?;
    let completion = caller.0.map(|window| window.stop(viewer));
    Ok(async move {
        Ok(match completion {
            Some(work) => work.await,
            None => false,
        })
    })
}

impl LogTail {
    fn issue_viewer_id(&self, window: &Arc<LogWindow>) -> Result<u64, String> {
        let mut current = window.0.lock().unwrap();
        if current.retired {
            return Err("Window closed".into());
        }
        let mut last = self.last_issued.lock().unwrap();
        if *last == MAX_SAFE_ID {
            return Err("Log viewer IDs exhausted".into());
        }
        *last += 1;
        let id = *last;
        current.issue(id);
        Ok(id)
    }

    fn stream(
        &self,
        window: &Arc<LogWindow>,
        channel: Channel<LogStreamEvent>,
        viewer: Viewer,
    ) -> impl std::future::Future<Output = Result<(), String>> + Send + 'static {
        let admitted = {
            let mut current = window.0.lock().unwrap();
            current.begin(viewer).map(|generation| {
                (
                    ActiveSubscription {
                        window: window.clone(),
                        generation,
                    },
                    current.sending.clone(),
                )
            })
        };
        let path = self.path.clone();
        async move {
            let Some((active, sending)) = admitted else {
                return Ok(());
            };
            let window = &active.window;
            let generation = active.generation;
            if let Some(sending) = sending {
                drop(sending.send.lock().await);
            }
            let mut cursor = Cursor::default();
            loop {
                let current = window.clone();
                let path = path.clone();
                let channel = channel.clone();
                let result = tokio::task::spawn_blocking(move || -> io::Result<_> {
                    let (events, more) = cursor.poll(&path)?;
                    for event in events {
                        let guard = {
                            let mut current = current.0.lock().unwrap();
                            let Some(active) = current
                                .active
                                .as_ref()
                                .filter(|a| a.generation == generation)
                            else {
                                return Ok(None);
                            };
                            // This generation has one polling worker. Only retired generations have waiters.
                            let guard = active
                                .send
                                .clone()
                                .try_lock_owned()
                                .expect("single log sender");
                            current.sending = Some(active.clone());
                            guard
                        };
                        if channel.send(event).is_err() {
                            return Ok(None);
                        }
                        drop(guard);
                    }
                    Ok(Some((cursor, more)))
                })
                .await
                .map_err(|e| e.to_string())?
                .map_err(|e| e.to_string())?;
                let Some((next, more)) = result else {
                    return Ok(());
                };
                if window
                    .0
                    .lock()
                    .unwrap()
                    .active
                    .as_ref()
                    .map(|a| a.generation)
                    != Some(generation)
                {
                    return Ok(());
                }
                cursor = next;
                if !more {
                    tokio::time::sleep(TICK).await;
                }
            }
        }
    }
}

pub(crate) fn stream_logs<R: tauri::Runtime>(
    invoke: &crate::Invoke<R>,
) -> Result<impl std::future::Future<Output = Result<(), String>>, tauri::ipc::InvokeError> {
    const NAME: &str = "stream_logs";
    let (caller, viewer) = bind_viewer(invoke, NAME)?;
    let channel =
        crate::ipc_dispatch::channel(invoke, NAME, "onEvent", crate::ipc_dispatch::Delivery::Wait)?;
    let tail = crate::argument::<State<Arc<LogTail>>, _>(invoke, NAME, "state")?
        .inner()
        .clone();
    let completion = caller.0.and_then(|window| {
        let closed = WebviewLifetime::for_caller(invoke.message.webview_ref())?;
        Some((closed, tail.stream(&window, channel, viewer)))
    });
    Ok(async move {
        match completion {
            Some((mut closed, work)) => tokio::select! {
                biased;
                _ = closed.changed() => Ok(()),
                result = work => result,
            },
            None => Ok(()),
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn page(table: &mut ResourceTable) -> Arc<LogWindow> {
        page_changed(table, false);
        table.get(LogWindow::resource(table).unwrap()).unwrap()
    }

    #[tokio::test]
    async fn admitted_send_does_not_block_stop_or_replacement() {
        let file = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(file.path(), "hello\n").unwrap();
        let tail = LogTail::new(file.path().into());
        let mut table = ResourceTable::default();
        let window = page(&mut table);
        let (entered, mut started) = tokio::sync::mpsc::unbounded_channel();
        let (release, wait) = std::sync::mpsc::channel();
        let wait = Mutex::new(wait);
        let original = tail.stream(
            &window,
            Channel::new(move |_| {
                entered.send(()).unwrap();
                wait.lock()
                    .unwrap()
                    .recv_timeout(Duration::from_secs(5))
                    .unwrap();
                Ok(())
            }),
            Viewer::Legacy(Some(1)),
        );
        tokio::pin!(original);
        tokio::select! { _ = &mut original => panic!("send finished"), _ = started.recv() => {} }
        let stop = window.stop(Viewer::Legacy(Some(1)));
        tokio::pin!(stop);
        assert!(futures_util::poll!(&mut stop).is_pending());
        let (events, mut received) = tokio::sync::mpsc::unbounded_channel();
        let replacement = tail.stream(
            &window,
            Channel::new(move |event| {
                events.send(event).unwrap();
                Ok(())
            }),
            Viewer::Legacy(Some(2)),
        );
        tokio::pin!(replacement);
        assert!(futures_util::poll!(&mut replacement).is_pending());
        tokio::spawn(async move { release.send(()).unwrap() })
            .await
            .unwrap();
        assert!(stop.await);
        original.await.unwrap();
        assert!(started.try_recv().is_err());
        let event = tokio::select! { _ = &mut replacement => panic!("replacement finished"), e = received.recv() => e.unwrap() };
        let tauri::ipc::InvokeResponseBody::Json(json) = event else {
            panic!()
        };
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&json).unwrap()["type"],
            "snapshot"
        );
        assert!(window.stop(Viewer::Legacy(Some(2))).await);
        replacement.await.unwrap();
    }

    #[tokio::test]
    async fn delayed_stop_leaves_reopened_viewer_receiving_lines() {
        for keyed in [false, true] {
            let file = tempfile::NamedTempFile::new().unwrap();
            let tail = LogTail::new(file.path().into());
            let mut table = ResourceTable::default();
            let window = page(&mut table);
            let viewer = || {
                if keyed {
                    Viewer::Token(tail.issue_viewer_id(&window).unwrap())
                } else {
                    Viewer::Legacy(None)
                }
            };
            let first = viewer();
            let second = viewer();
            let original = tail.stream(&window, Channel::new(|_| Ok(())), first);
            let delayed_stop = window.stop(first);
            let (events, mut rx) = tokio::sync::mpsc::unbounded_channel();
            let replacement = tail.stream(
                &window,
                Channel::new(move |event| {
                    events.send(event).unwrap();
                    Ok(())
                }),
                second,
            );
            tokio::pin!(replacement);
            tokio::time::timeout(Duration::from_secs(5), async {
            tokio::select! { _ = &mut replacement => panic!("viewer exited"), _ = rx.recv() => {} }
            assert!(delayed_stop.await);
            std::fs::write(file.path(), "new line\n").unwrap();
            let event = tokio::select! { _ = &mut replacement => panic!("viewer exited"), e = rx.recv() => e.unwrap() };
            let tauri::ipc::InvokeResponseBody::Json(json) = event else { panic!() };
            assert_eq!(serde_json::from_str::<serde_json::Value>(&json).unwrap(), serde_json::json!({"type":"lines","data":["new line"]}));
            assert!(window.stop(second).await);
            replacement.await.unwrap();
            original.await.unwrap();
        }).await.unwrap();
        }
    }

    #[tokio::test]
    async fn delayed_start_cannot_evict_new_viewer_and_reload_retires_quiet_poll() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let tail = LogTail::new(file.path().into());
        let mut table = ResourceTable::default();
        let window = page(&mut table);
        let a = tail.issue_viewer_id(&window).unwrap();
        let mut other = ResourceTable::default();
        let foreign_window = page(&mut other);
        let foreign = tail.issue_viewer_id(&foreign_window).unwrap();
        let b = tail.issue_viewer_id(&window).unwrap();
        tail.stream(
            &window,
            Channel::new(|_| panic!("foreign ID admitted")),
            Viewer::Token(foreign),
        )
        .await
        .unwrap();
        assert!(!foreign_window.stop(Viewer::Token(b)).await);
        let (events, mut rx) = tokio::sync::mpsc::unbounded_channel();
        page(&mut other);
        page_changed(&mut other, false);
        page_changed(&mut other, true);
        let stream = tail.stream(
            &window,
            Channel::new(move |event| {
                events.send(event).unwrap();
                Ok(())
            }),
            Viewer::Token(b),
        );
        tokio::pin!(stream);
        tokio::time::timeout(Duration::from_secs(5), async {
            tokio::select! { _ = &mut stream => panic!("stream ended"), _ = rx.recv() => {} }
            page(&mut other);
            page_changed(&mut other, false);
            page_changed(&mut other, true);
            tail.stream(&window, Channel::new(|_| panic!("stale start sent")), Viewer::Token(a)).await.unwrap();
            assert!(!window.stop(Viewer::Token(a)).await);
            std::fs::write(file.path(), "still watching\n").unwrap();
            let event = tokio::select! { _ = &mut stream => panic!("stream ended"), e = rx.recv() => e.unwrap() };
            let tauri::ipc::InvokeResponseBody::Json(json) = event else {panic!()};
            assert_eq!(serde_json::from_str::<serde_json::Value>(&json).unwrap()["data"], serde_json::json!(["still watching"]));
            let pending = tail.issue_viewer_id(&window).unwrap();
            page_changed(&mut table, false);
            stream.await.unwrap();
            tail.stream(&window, Channel::new(|_| panic!("retired page sent")), Viewer::Token(pending)).await.unwrap();
        }).await.unwrap();
    }

    #[tokio::test]
    async fn stopping_pending_viewer_preserves_earlier_snapshot() {
        let file = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(file.path(), "hello\n").unwrap();
        let tail = LogTail::new(file.path().into());
        let window = page(&mut ResourceTable::default());
        let first = Viewer::Token(tail.issue_viewer_id(&window).unwrap());
        let second = Viewer::Token(tail.issue_viewer_id(&window).unwrap());
        let third = Viewer::Token(tail.issue_viewer_id(&window).unwrap());
        assert!(!window.stop(second).await);
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let stream = tail.stream(
            &window,
            Channel::new(move |event| {
                tx.send(event).unwrap();
                Ok(())
            }),
            first,
        );
        let running = tokio::spawn(stream);
        let event = tokio::time::timeout(Duration::from_secs(5), rx.recv())
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            event.deserialize::<serde_json::Value>().unwrap(),
            serde_json::json!({"type":"snapshot","data":["hello"]})
        );
        assert!(window.stop(first).await);
        running.await.unwrap().unwrap();
        let mut state = window.0.lock().unwrap();
        assert!(state.begin(second).is_none());
        assert!(state.begin(third).is_some());
    }

    #[tokio::test]
    async fn recreated_window_rejects_retired_ids_and_honors_legacy_stops() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let tail = LogTail::new(file.path().into());
        let mut table = ResourceTable::default();
        let window = page(&mut table);
        let old = tail.issue_viewer_id(&window).unwrap();
        page_changed(&mut table, true);
        tail.stream(
            &window,
            Channel::new(|_| panic!("destroyed window sent")),
            Viewer::Legacy(Some(u64::MAX)),
        )
        .await
        .unwrap();
        let window = page(&mut table);
        assert!(tail.issue_viewer_id(&window).unwrap() > old);
        assert!(!window.stop(Viewer::Legacy(Some(100))).await);
        for rejected in [Viewer::Token(old), Viewer::Legacy(Some(100))] {
            tail.stream(
                &window,
                Channel::new(|_| panic!("retired viewer sent")),
                rejected,
            )
            .await
            .unwrap();
        }
        let (events, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let stream = tail.stream(
            &window,
            Channel::new(move |event| {
                events.send(event).unwrap();
                Ok(())
            }),
            Viewer::Legacy(Some(12)),
        );
        tokio::pin!(stream);
        tokio::time::timeout(Duration::from_secs(5), async {
            for expected in [serde_json::json!({"type":"snapshot","data":[]}), serde_json::json!({"type":"lines","data":["hello"]})] {
                let event = tokio::select! { _ = &mut stream => panic!("viewer exited"), e = rx.recv() => e.unwrap() };
                let tauri::ipc::InvokeResponseBody::Json(json) = event else { panic!() };
                assert_eq!(serde_json::from_str::<serde_json::Value>(&json).unwrap(), expected);
                std::fs::write(file.path(), "hello\n").unwrap();
            }
            assert!(window.stop(Viewer::Legacy(Some(12))).await);
            stream.await.unwrap();
        }).await.unwrap();
    }

    #[tokio::test]
    async fn navigation_preserves_legacy_stops_and_protects_the_new_token_viewer() {
        let root = tempfile::tempdir().unwrap();
        let tail = LogTail::new(root.path().join("log"));
        let mut table = ResourceTable::default();
        let old = page(&mut table);
        for id in [1 << 40, u64::MAX] {
            let legacy = Viewer::from_args(Some(id), None);
            assert!(old.0.lock().unwrap().begin(legacy).is_some());
            assert!(old.stop(legacy).await);
        }
        let stopped = Viewer::Legacy(Some(1 << 40));
        let delayed = tail.stream(&old, Channel::new(|_| panic!("retired page sent")), stopped);
        let pending = Viewer::Legacy(Some(42));
        let stop = old.stop(pending);
        let new = page(&mut table);
        assert!(!stop.await);
        assert!(new.0.lock().unwrap().begin(pending).is_none());
        assert!(new.0.lock().unwrap().begin(stopped).is_none());
        let token = tail.issue_viewer_id(&new).unwrap();
        let viewer = Viewer::from_args(None, Some(token));
        assert!(new.0.lock().unwrap().begin(viewer).is_some());
        delayed.await.unwrap();
        let same_number = Viewer::from_args(Some(token), None);
        assert!(new.0.lock().unwrap().begin(same_number).is_none());
        assert!(!new.stop(same_number).await);
        assert!(new.stop(viewer).await);
    }

    #[test]
    fn replaced_viewer_cannot_stop_current_stream() {
        let mut sub = Subscription::default();
        assert!(sub.begin(Viewer::Legacy(Some(1))) < sub.begin(Viewer::Legacy(Some(2))));
        assert!(!sub.stop(Viewer::Legacy(Some(1))));
        assert!(!sub.stop(Viewer::Legacy(None)));
        assert!(sub.stop(Viewer::Legacy(Some(2))));
    }

    #[test]
    fn stopped_before_begin_and_replaced_ids_stay_inactive() {
        let mut sub = Subscription::default();
        assert!(!sub.stop(Viewer::Legacy(Some(100))));
        assert_eq!(sub.begin(Viewer::Legacy(Some(100))), None);
        assert!(sub.begin(Viewer::Legacy(Some(12))).is_some());
        assert!(sub.begin(Viewer::Legacy(Some(101))).is_some());
        assert!(sub.begin(Viewer::Legacy(Some(102))).is_some());
        assert!(sub.begin(Viewer::Legacy(Some(101))).is_none());
        assert!(sub.stop(Viewer::Legacy(Some(102))));
    }
    #[test]
    fn long_records_are_bounded_and_preserve_utf8() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let data = format!("{}界{}\n", "a".repeat(CHUNK - 1), "b".repeat(CHUNK));
        std::fs::write(file.path(), &data).unwrap();
        let mut cursor = Cursor::default();
        let mut reconstructed = String::new();
        loop {
            let (events, more) = cursor.poll(file.path()).unwrap();
            for event in events {
                if let LogStreamEvent::Snapshot(lines) | LogStreamEvent::Lines(lines) = event {
                    reconstructed.push_str(&lines.concat());
                }
            }
            assert!(cursor.partial.len() <= CHUNK);
            if !more {
                break;
            }
        }
        assert_eq!(reconstructed, data.trim_end());
    }

    #[test]
    fn partial_lines_and_equal_size_replacement() {
        use std::io::Write;
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("latest");
        std::fs::write(&path, "abc").unwrap();
        let mut cursor = Cursor::default();
        cursor.poll(&path).unwrap();
        assert_eq!(cursor.offset, 3);
        assert!(cursor.poll(&path).unwrap().0.is_empty());
        File::options()
            .append(true)
            .open(&path)
            .unwrap()
            .write_all(b"d\n")
            .unwrap();
        assert!(
            matches!(&cursor.poll(&path).unwrap().0[..], [LogStreamEvent::Lines(lines)] if lines == &["abcd"])
        );
        std::fs::rename(&path, tmp.path().join("old")).unwrap();
        std::fs::write(&path, "next\n").unwrap();
        assert!(
            matches!(&cursor.poll(&path).unwrap().0[..], [LogStreamEvent::Truncated, LogStreamEvent::Lines(lines)] if lines == &["next"])
        );
    }
}

const ARCHIVES: usize = 10;
pub(crate) const LOG_BYTES: u64 = 8 * 1024 * 1024;

pub(crate) fn retry_locked_rotation<T>(
    latest: &Path,
    result: Result<T, tauri_plugin_log::Error>,
    open: impl FnOnce(tauri_plugin_log::FileOpenStrategy, u64) -> Result<T, tauri_plugin_log::Error>,
) -> Result<T, tauri_plugin_log::Error> {
    let Err(tauri_plugin_log::Error::Io(ref e)) = result else {
        return result;
    };
    #[cfg(windows)]
    let denied = matches!(e.raw_os_error(), Some(5 | 32 | 33));
    #[cfg(not(windows))]
    let denied =
        e.kind() == io::ErrorKind::PermissionDenied || e.raw_os_error() == Some(libc::EROFS);
    if !denied {
        return result;
    }

    #[cfg(windows)]
    {
        // A locked same-second collision archive can leave latest.log itself free to rotate.
        let mut stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(io::Error::other)?
            .as_nanos();
        loop {
            let backup = latest.with_file_name(format!("kaede-{stamp}.log"));
            match crate::file_system::move_noclobber(latest, &backup) {
                Ok(()) => return open(tauri_plugin_log::FileOpenStrategy::Rotate, LOG_BYTES),
                Err(e) if e.kind() == io::ErrorKind::AlreadyExists => stamp += 1,
                Err(e) if matches!(e.raw_os_error(), Some(5 | 32 | 33)) => break,
                Err(_) => return result,
            }
        }
    }
    // Even Append rotates on open when the current size reaches the limit.
    let size = latest.metadata()?.len();
    let limit = if size >= LOG_BYTES {
        size.saturating_add(LOG_BYTES)
    } else {
        LOG_BYTES
    };
    open(tauri_plugin_log::FileOpenStrategy::Append, limit)
}

fn archive_number(name: &str) -> Option<u64> {
    if let Some(number) = name.strip_prefix("kaede-")?.strip_suffix(".log") {
        if number.bytes().all(|b| b.is_ascii_digit()) {
            return number.parse().ok();
        }
    }
    None
}

fn dated_archive(name: &str) -> bool {
    let name = name.strip_suffix(".bak").unwrap_or(name);
    name.strip_prefix("latest_")
        .and_then(|s| s.strip_suffix(".log"))
        .is_some_and(|date| {
            time::PrimitiveDateTime::parse(
                date,
                time::macros::format_description!("[year]-[month]-[day]_[hour]-[minute]-[second]"),
            )
            .is_ok()
        })
}

impl LogTail {
    pub(crate) fn seed_active_size(&self) -> io::Result<()> {
        *self.logged_bytes.lock().unwrap() = self.path.metadata()?.len();
        Ok(())
    }

    pub(crate) fn write_record(self: &Arc<Self>, count: u64, limit: u64, write: impl FnOnce()) {
        // Serialize dispatch and accounting so concurrent formatters observe the file's write order.
        let mut active = self.logged_bytes.lock().unwrap();
        write();
        let next = active.saturating_add(count);
        let rotated = *active != 0 && next > limit;
        *active = if rotated { count } else { next };
        drop(active);
        if rotated && self.retention_enabled.load(Ordering::Relaxed) {
            let tail = self.clone();
            tauri::async_runtime::spawn_blocking(move || {
                if let Err(error) = tail.trim_archives() {
                    log::warn!("Cannot trim log archives: {error}");
                }
            });
        }
    }

    pub(crate) fn trim_archives(&self) -> io::Result<()> {
        static WRITER: Mutex<()> = Mutex::new(());
        let _writer = WRITER.lock().unwrap();
        self.retention_enabled.store(true, Ordering::Relaxed);
        let mut archives = Vec::new();
        for entry in std::fs::read_dir(self.path.parent().unwrap())? {
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    log::warn!("Cannot inspect archive directory entry: {error}");
                    continue;
                }
            };
            let name = entry.file_name();
            let Some(name) = name.to_str() else { continue };
            let number = archive_number(name);
            if number.is_none() && !dated_archive(name) {
                continue;
            }
            match entry.metadata() {
                Ok(meta) if meta.is_file() && !crate::mod_store::is_reparse_point(&meta) => {
                    match meta.modified() {
                        Ok(time) => archives.push((time, number, entry.path())),
                        Err(e) => log::warn!("Cannot read log archive time for {name}: {e}"),
                    }
                }
                Ok(_) => (),
                Err(e) => log::warn!("Cannot inspect log archive {name}: {e}"),
            }
        }
        archives.sort_unstable();
        for (_, _, path) in archives.drain(..archives.len().saturating_sub(ARCHIVES)) {
            if let Err(e) = std::fs::remove_file(&path) {
                log::warn!("Cannot remove log archive {}: {e}", path.display());
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod retention_tests {
    use super::*;
    #[tokio::test]
    async fn trim_follows_rotation_after_exact_fit_and_after_an_oversized_record() {
        let dir = tempfile::tempdir().unwrap();
        let latest = dir.path().join("latest.log");
        std::fs::write(&latest, [0; 8]).unwrap();
        let tail = Arc::new(LogTail::new(latest.clone()));
        let app = tauri::test::mock_builder()
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let writer = tail.clone();
        let (_, _, logger) = tauri_plugin_log::Builder::new()
            .clear_targets()
            .target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::Folder {
                    path: dir.path().into(),
                    file_name: Some("latest".into()),
                },
            ))
            .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
            .file_open_strategy(tauri_plugin_log::FileOpenStrategy::Append)
            .max_file_size(10)
            .format(move |out, msg, _| {
                let line = msg.to_string();
                writer.write_record(line.len() as u64 + 1, 10, || {
                    out.finish(format_args!("{line}"))
                });
            })
            .split(app.handle())
            .unwrap();
        tail.seed_active_size().unwrap();
        for n in 0..ARCHIVES {
            File::create(dir.path().join(format!("kaede-{n}.log"))).unwrap();
        }
        tail.trim_archives().unwrap();
        for (line, size) in [("a", 10), ("", 1), ("0123456789", 11), ("b", 2)] {
            logger.log(
                &log::Record::builder()
                    .args(format_args!("{line}"))
                    .level(log::Level::Info)
                    .build(),
            );
            assert_eq!(latest.metadata().unwrap().len(), size);
            tokio::time::timeout(Duration::from_secs(5), async {
                while std::fs::read_dir(dir.path()).unwrap().count() > ARCHIVES + 1 {
                    tokio::time::sleep(Duration::from_millis(5)).await;
                }
            })
            .await
            .unwrap();
        }
    }
    #[cfg(windows)]
    #[test]
    fn real_plugin_appends_to_delete_locked_latest_including_oversized_files() {
        use std::os::windows::fs::OpenOptionsExt;
        use tauri_plugin_log::{Builder, FileOpenStrategy, RotationStrategy, Target, TargetKind};
        let app = tauri::test::mock_builder()
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        for size in [3, LOG_BYTES + 1] {
            let dir = tempfile::tempdir().unwrap();
            let latest = dir.path().join("latest.log");
            File::create(&latest).unwrap().set_len(size).unwrap();
            let _reader = File::options()
                .read(true)
                .share_mode(3)
                .open(&latest)
                .unwrap();
            let open = |strategy, limit: u64| {
                Builder::new()
                    .clear_targets()
                    .target(Target::new(TargetKind::Folder {
                        path: dir.path().into(),
                        file_name: Some("latest".into()),
                    }))
                    .rotation_strategy(RotationStrategy::KeepAll)
                    .file_open_strategy(strategy)
                    .max_file_size(limit.into())
                    .split(app.handle())
            };
            let (_, _, logger) =
                retry_locked_rotation(&latest, open(FileOpenStrategy::Rotate, LOG_BYTES), open)
                    .unwrap();
            logger.log(
                &log::Record::builder()
                    .args(format_args!("still logging"))
                    .level(log::Level::Info)
                    .build(),
            );
            assert!(std::fs::read(&latest)
                .unwrap()
                .ends_with(b"still logging\n"));
        }
    }
    #[cfg(windows)]
    #[test]
    fn same_second_rotation_can_open_a_fresh_log_while_the_dated_archive_is_locked() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let latest = dir.path().join("latest.log");
        let archive = dir.path().join("latest_2026-01-01_00-00-00.log");
        std::fs::write(&latest, b"previous session").unwrap();
        std::fs::write(&archive, b"older archive").unwrap();
        let locked = File::options()
            .read(true)
            .share_mode(0)
            .open(&archive)
            .unwrap();
        let open = || -> Result<_, tauri_plugin_log::Error> {
            if latest.exists() {
                std::fs::rename(&archive, archive.with_extension("log.bak"))?;
            }
            Ok(File::create_new(&latest)?)
        };
        let fresh = retry_locked_rotation(&latest, open(), |_, _| open()).unwrap();
        assert_eq!(fresh.metadata().unwrap().len(), 0);
        drop(locked);
        assert_eq!(std::fs::read(archive).unwrap(), b"older archive");
        let saved = std::fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .find(|e| archive_number(&e.file_name().to_string_lossy()).is_some())
            .unwrap();
        assert_eq!(std::fs::read(saved.path()).unwrap(), b"previous session");
    }
    #[cfg(windows)]
    #[test]
    fn a_locked_archive_does_not_block_trimming_other_old_logs() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        for n in 0..ARCHIVES + 4 {
            File::create(dir.path().join(format!("kaede-{n}.log")))
                .unwrap()
                .set_modified(std::time::SystemTime::UNIX_EPOCH)
                .unwrap();
        }
        let locked = dir.path().join("kaede-0.log");
        let _lock = File::options()
            .read(true)
            .share_mode(0)
            .open(&locked)
            .unwrap();
        LogTail::new(dir.path().join("latest.log"))
            .trim_archives()
            .unwrap();
        assert!(locked.exists());
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), ARCHIVES + 1);
    }
    #[test]
    fn unified_retention_handles_legacy_dated_and_collision_archives() {
        let dir = tempfile::tempdir().unwrap();
        for i in 0..13 {
            File::create(dir.path().join(format!("kaede-{i}.log"))).unwrap();
        }
        let paths = [
            "latest_2026-01-01_01-00-00.log",
            "latest_2026-01-01_01-00-00.log.bak",
        ];
        let keep = dir.path().join("latest_user.log");
        File::create(&keep).unwrap();
        for name in paths {
            let file = File::create(dir.path().join(name)).unwrap();
            file.set_modified(std::time::SystemTime::UNIX_EPOCH)
                .unwrap();
        }
        let latest = dir.path().join("latest.log");
        File::create(&latest).unwrap();
        let tail = LogTail::new(latest.clone());
        tail.trim_archives().unwrap();
        assert!(latest.exists() && keep.exists());
        for name in paths {
            assert!(!dir.path().join(name).exists());
        }
        for i in 0..13 {
            assert_eq!(dir.path().join(format!("kaede-{i}.log")).exists(), i >= 3);
        }
        for name in paths {
            File::create(dir.path().join(name)).unwrap();
        }
        tail.trim_archives().unwrap();
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), ARCHIVES + 2);
    }
}
