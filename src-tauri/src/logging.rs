use same_file::Handle;
use serde::Serialize;
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
use tauri::{ipc::Channel, Manager, ResourceTable, State};
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
            self.consume_issued(id);
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

fn bind_viewer(
    invoke: &crate::Invoke,
    name: &'static str,
) -> Result<(LogCaller, Viewer), tauri::ipc::InvokeError> {
    let caller = crate::argument(invoke, name, "window")?;
    let legacy = crate::argument(invoke, name, "subscriptionId")?;
    let token = crate::argument(invoke, name, "token")?;
    Ok((caller, Viewer::from_args(legacy, token)))
}

pub(crate) fn stop_log_stream(
    invoke: &crate::Invoke,
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

pub(crate) fn stream_logs(
    invoke: &crate::Invoke,
) -> Result<impl std::future::Future<Output = Result<(), String>>, tauri::ipc::InvokeError> {
    const NAME: &str = "stream_logs";
    let (caller, viewer) = bind_viewer(invoke, NAME)?;
    let channel =
        crate::ipc_dispatch::channel(invoke, NAME, "onEvent", crate::ipc_dispatch::Delivery::Wait)?;
    let tail = crate::argument::<State<Arc<LogTail>>, _>(invoke, NAME, "state")?
        .inner()
        .clone();
    let completion = caller.0.map(|window| tail.stream(&window, channel, viewer));
    Ok(async move {
        match completion {
            Some(work) => work.await,
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
