use same_file::Handle;
use serde::Serialize;
///
/// ATTENTION: AI-generated (by Qwen 3.8-Max and Claude Fable 5 on 'max' reasoning)
///
use std::{
    collections::{HashMap, VecDeque},
    fs::File,
    io::{self, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{ipc::Channel, State};
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
    registry: Mutex<Registry>,
}

const SERVER_ID_BASE: u64 = 1 << 40;
const MAX_SAFE_ID: u64 = (1 << 53) - 1;

#[derive(Default)]
struct Registry {
    last_issued: u64,
    windows: HashMap<String, Arc<Mutex<Subscription>>>,
}

impl Registry {
    fn window(&mut self, label: &str, viewer: Option<u64>) -> Option<&Arc<Mutex<Subscription>>> {
        if viewer.is_some_and(|id| id >= SERVER_ID_BASE) {
            self.windows.get(label)
        } else {
            Some(self.windows.entry(label.to_owned()).or_default())
        }
    }
}

#[derive(Default)]
struct Subscription {
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
    viewer: Option<u64>,
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

    fn remember(&mut self, viewer: Option<u64>) {
        if let Some(id) = viewer.filter(|id| *id < SERVER_ID_BASE) {
            if !self.stopped_legacy.contains(&id) {
                const RECENT: usize = 64;
                if self.stopped_legacy.len() == RECENT {
                    self.stopped_legacy.pop_front();
                }
                self.stopped_legacy.push_back(id);
            }
        }
    }
    fn begin(&mut self, viewer: Option<u64>) -> Option<u64> {
        if let Some(id) = viewer.filter(|id| *id >= SERVER_ID_BASE) {
            if !self.consume_issued(id) {
                return None;
            }
        } else if viewer.is_some_and(|id| self.stopped_legacy.contains(&id))
            || self
                .active
                .as_ref()
                .is_some_and(|a| a.viewer.is_some() && (viewer.is_none() || viewer == a.viewer))
        {
            return None;
        }
        let old = self.active.take().and_then(|a| a.viewer);
        self.remember(old);
        self.generation += 1;
        self.active = Some(ActiveViewer {
            generation: self.generation,
            viewer,
            send: Arc::default(),
        });
        Some(self.generation)
    }

    fn stop(&mut self, viewer: Option<u64>) -> bool {
        self.remember(viewer);
        if let Some(id) = viewer.filter(|id| *id >= SERVER_ID_BASE) {
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

struct ActiveSubscription<'a> {
    current: &'a Mutex<Subscription>,
    generation: u64,
}

impl Drop for ActiveSubscription<'_> {
    fn drop(&mut self) {
        let mut current = self.current.lock().unwrap();
        if current.generation == self.generation {
            current.active = None;
        }
    }
}

impl LogTail {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            registry: Mutex::default(),
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

pub struct WindowLabel(String);

impl<R: tauri::Runtime> tauri::ipc::CommandArg<'_, R> for WindowLabel {
    fn from_command(item: tauri::ipc::CommandItem<'_, R>) -> Result<Self, tauri::ipc::InvokeError> {
        Ok(Self(
            item.message.webview_ref().window_ref().label().to_owned(),
        ))
    }
}

#[tauri::command]
pub fn next_log_subscription_id(
    window: WindowLabel,
    state: State<'_, LogTail>,
) -> Result<u64, String> {
    state.issue_viewer_id(&window.0)
}

#[tauri::command]
pub async fn stop_log_stream(
    window: WindowLabel,
    state: State<'_, LogTail>,
    subscription_id: Option<u64>,
) -> Result<bool, String> {
    Ok(state.stop(&window.0, subscription_id).await)
}

impl LogTail {
    fn issue_viewer_id(&self, label: &str) -> Result<u64, String> {
        let mut registry = self.registry.lock().unwrap();
        let id = registry.last_issued.max(SERVER_ID_BASE - 1) + 1;
        if id > MAX_SAFE_ID {
            return Err("Log viewer IDs exhausted".into());
        }
        registry.last_issued = id;
        registry
            .windows
            .entry(label.to_owned())
            .or_default()
            .lock()
            .unwrap()
            .issue(id);
        Ok(id)
    }

    pub fn retire_window(&self, label: &str, destroyed: bool) {
        let mut registry = self.registry.lock().unwrap();
        if let Some(window) = registry.windows.get(label) {
            let mut window = window.lock().unwrap();
            window.active = None;
            window.pending_issued.clear();
            window.stopped_legacy.clear();
        }
        if destroyed {
            registry.windows.remove(label);
        }
    }

    async fn stop(&self, label: &str, viewer: Option<u64>) -> bool {
        let (stopped, sending) = {
            let mut registry = self.registry.lock().unwrap();
            let Some(window) = registry.window(label, viewer) else {
                return false;
            };
            let mut current = window.lock().unwrap();
            let stopped = current.stop(viewer);
            (
                stopped,
                current
                    .sending
                    .clone()
                    .filter(|s| stopped || s.viewer == viewer),
            )
        };
        if let Some(sending) = sending {
            drop(sending.send.lock().await);
        }
        stopped
    }

    async fn stream(
        &self,
        label: &str,
        channel: Channel<LogStreamEvent>,
        viewer: Option<u64>,
    ) -> Result<(), String> {
        let (window, generation, sending) = {
            let mut registry = self.registry.lock().unwrap();
            let Some(window) = registry.window(label, viewer) else {
                return Ok(());
            };
            let mut current = window.lock().unwrap();
            let Some(generation) = current.begin(viewer) else {
                return Ok(());
            };
            (window.clone(), generation, current.sending.clone())
        };
        let _active = ActiveSubscription {
            current: &window,
            generation,
        };
        if let Some(sending) = sending {
            drop(sending.send.lock().await);
        }
        let mut cursor = Cursor::default();
        let path = self.path.clone();
        loop {
            let current = window.clone();
            let path = path.clone();
            let channel = channel.clone();
            let result = tokio::task::spawn_blocking(move || -> io::Result<_> {
                let (events, more) = cursor.poll(&path)?;
                for event in events {
                    let guard = {
                        let mut current = current.lock().unwrap();
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
            if window.lock().unwrap().active.as_ref().map(|a| a.generation) != Some(generation) {
                return Ok(());
            }
            cursor = next;
            if !more {
                tokio::time::sleep(TICK).await;
            }
        }
    }
}

#[tauri::command]
pub async fn stream_logs(
    window: WindowLabel,
    state: State<'_, LogTail>,
    on_event: Channel<LogStreamEvent>,
    subscription_id: Option<u64>,
) -> Result<(), String> {
    state.stream(&window.0, on_event, subscription_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn admitted_send_does_not_block_stop_or_replacement() {
        let file = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(file.path(), "hello\n").unwrap();
        let tail = LogTail::new(file.path().into());
        let (entered, mut started) = tokio::sync::mpsc::unbounded_channel();
        let (release, wait) = std::sync::mpsc::channel();
        let wait = Mutex::new(wait);
        let original = tail.stream(
            "b",
            Channel::new(move |_| {
                entered.send(()).unwrap();
                wait.lock()
                    .unwrap()
                    .recv_timeout(Duration::from_secs(5))
                    .unwrap();
                Ok(())
            }),
            Some(1),
        );
        tokio::pin!(original);
        tokio::select! { _ = &mut original => panic!("send finished"), _ = started.recv() => {} }
        let stop = tail.stop("b", Some(1));
        tokio::pin!(stop);
        assert!(futures_util::poll!(&mut stop).is_pending());
        let (events, mut received) = tokio::sync::mpsc::unbounded_channel();
        let replacement = tail.stream(
            "b",
            Channel::new(move |event| {
                events.send(event).unwrap();
                Ok(())
            }),
            Some(2),
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
        assert!(tail.stop("b", Some(2)).await);
        replacement.await.unwrap();
    }

    #[tokio::test]
    async fn delayed_stop_leaves_reopened_viewer_receiving_lines() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let tail = LogTail::new(file.path().into());
        let a = tail.issue_viewer_id("b").unwrap();
        let b = tail.issue_viewer_id("b").unwrap();
        let original = tail.stream("b", Channel::new(|_| Ok(())), Some(a));
        tokio::pin!(original);
        assert!(futures_util::poll!(&mut original).is_pending());
        let delayed_stop = tail.stop("b", Some(a));
        let (events, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let replacement = tail.stream(
            "b",
            Channel::new(move |event| {
                events.send(event).unwrap();
                Ok(())
            }),
            Some(b),
        );
        tokio::pin!(replacement);
        tokio::time::timeout(Duration::from_secs(5), async {
            tokio::select! { _ = &mut replacement => panic!("viewer exited"), _ = rx.recv() => {} }
            assert!(!delayed_stop.await);
            std::fs::write(file.path(), "new line\n").unwrap();
            let event = tokio::select! { _ = &mut replacement => panic!("viewer exited"), e = rx.recv() => e.unwrap() };
            let tauri::ipc::InvokeResponseBody::Json(json) = event else { panic!() };
            assert_eq!(serde_json::from_str::<serde_json::Value>(&json).unwrap(), serde_json::json!({"type":"lines","data":["new line"]}));
            assert!(tail.stop("b", Some(b)).await);
            replacement.await.unwrap();
            original.await.unwrap();
        }).await.unwrap();
    }

    #[tokio::test]
    async fn delayed_start_cannot_evict_new_viewer_and_reload_retires_quiet_poll() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let tail = LogTail::new(file.path().into());
        let a = tail.issue_viewer_id("b").unwrap();
        let foreign = tail.issue_viewer_id("a").unwrap();
        let b = tail.issue_viewer_id("b").unwrap();
        tail.stream(
            "b",
            Channel::new(|_| panic!("foreign ID admitted")),
            Some(foreign),
        )
        .await
        .unwrap();
        assert!(!tail.stop("a", Some(b)).await);
        let (events, mut rx) = tokio::sync::mpsc::unbounded_channel();
        tail.issue_viewer_id("a").unwrap();
        tail.retire_window("a", false);
        tail.retire_window("a", true);
        let stream = tail.stream(
            "b",
            Channel::new(move |event| {
                events.send(event).unwrap();
                Ok(())
            }),
            Some(b),
        );
        tokio::pin!(stream);
        tokio::time::timeout(Duration::from_secs(5), async {
            tokio::select! { _ = &mut stream => panic!("stream ended"), _ = rx.recv() => {} }
            tail.issue_viewer_id("a").unwrap();
            tail.retire_window("a", false);
            tail.retire_window("a", true);
            tail.stream("b", Channel::new(|_| panic!("stale start sent")), Some(a)).await.unwrap();
            assert!(!tail.stop("b", Some(a)).await);
            std::fs::write(file.path(), "still watching\n").unwrap();
            let event = tokio::select! { _ = &mut stream => panic!("stream ended"), e = rx.recv() => e.unwrap() };
            let tauri::ipc::InvokeResponseBody::Json(json) = event else {panic!()};
            assert_eq!(serde_json::from_str::<serde_json::Value>(&json).unwrap()["data"], serde_json::json!(["still watching"]));
            let pending = tail.issue_viewer_id("b").unwrap();
            tail.retire_window("b", false);
            stream.await.unwrap();
            tail.stream("b", Channel::new(|_| panic!("retired page sent")), Some(pending)).await.unwrap();
        }).await.unwrap();
    }

    #[tokio::test]
    async fn recreated_window_rejects_retired_ids_and_honors_legacy_stops() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let tail = LogTail::new(file.path().into());
        let old = tail.issue_viewer_id("main").unwrap();
        tail.retire_window("main", true);
        assert!(tail.issue_viewer_id("main").unwrap() > old);
        assert!(!tail.stop("main", Some(100)).await);
        for rejected in [old, 100] {
            tail.stream(
                "main",
                Channel::new(|_| panic!("retired viewer sent")),
                Some(rejected),
            )
            .await
            .unwrap();
        }
        let (events, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let stream = tail.stream(
            "main",
            Channel::new(move |event| {
                events.send(event).unwrap();
                Ok(())
            }),
            Some(12),
        );
        tokio::pin!(stream);
        tokio::time::timeout(Duration::from_secs(5), async {
            for expected in [serde_json::json!({"type":"snapshot","data":[]}), serde_json::json!({"type":"lines","data":["hello"]})] {
                let event = tokio::select! { _ = &mut stream => panic!("viewer exited"), e = rx.recv() => e.unwrap() };
                let tauri::ipc::InvokeResponseBody::Json(json) = event else { panic!() };
                assert_eq!(serde_json::from_str::<serde_json::Value>(&json).unwrap(), expected);
                std::fs::write(file.path(), "hello\n").unwrap();
            }
            assert!(tail.stop("main", Some(12)).await);
            stream.await.unwrap();
        }).await.unwrap();
    }

    #[test]
    fn replaced_viewer_cannot_stop_current_stream() {
        let mut sub = Subscription::default();
        assert!(sub.begin(Some(1)) < sub.begin(Some(2)));
        assert!(!sub.stop(Some(1)));
        assert!(!sub.stop(None));
        assert!(sub.stop(Some(2)));
    }

    #[test]
    fn stopped_before_begin_and_replaced_ids_stay_inactive() {
        let mut sub = Subscription::default();
        assert!(!sub.stop(Some(100)));
        assert_eq!(sub.begin(Some(100)), None);
        assert!(sub.begin(Some(12)).is_some());
        assert!(sub.begin(Some(101)).is_some());
        assert!(sub.begin(Some(102)).is_some());
        assert!(sub.begin(Some(101)).is_none());
        assert!(sub.stop(Some(102)));
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
