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
    sync::Mutex,
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
    current: Mutex<Subscription>,
}

#[derive(Default)]
struct Subscription {
    generation: u64,
    viewer: Option<u64>,
    active: bool,
    stopped: VecDeque<u64>,
}

impl Subscription {
    fn remember(&mut self, viewer: Option<u64>) {
        const RECENT_STOPS: usize = 64;
        if let Some(id) = viewer {
            if !self.stopped.contains(&id) {
                if self.stopped.len() == RECENT_STOPS {
                    self.stopped.pop_front();
                }
                self.stopped.push_back(id);
            }
        }
    }
    fn begin(&mut self, viewer: Option<u64>) -> Option<u64> {
        if viewer.is_some_and(|id| self.stopped.contains(&id))
            || self.active && self.viewer.is_some() && (viewer.is_none() || viewer == self.viewer)
        {
            return None;
        }
        self.remember(self.viewer);
        self.generation += 1;
        self.viewer = viewer;
        self.active = true;
        Some(self.generation)
    }

    fn stop(&mut self, viewer: Option<u64>) -> bool {
        self.remember(viewer);
        if self.active && self.viewer == viewer {
            self.active = false;
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
            current.active = false;
        }
    }
}

impl LogTail {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            current: Mutex::default(),
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

#[tauri::command]
pub fn stop_log_stream(state: State<'_, LogTail>, subscription_id: Option<u64>) -> bool {
    state.current.lock().unwrap().stop(subscription_id)
}

#[tauri::command]
pub async fn stream_logs(
    state: State<'_, LogTail>,
    on_event: Channel<LogStreamEvent>,
    subscription_id: Option<u64>,
) -> Result<(), String> {
    let Some(generation) = state.current.lock().unwrap().begin(subscription_id) else {
        return Ok(());
    };
    let _active = ActiveSubscription {
        current: &state.current,
        generation,
    };
    let mut cursor = Cursor::default();
    let mut path = state.path.clone();
    loop {
        let (poll, next_cursor, next_path) = tokio::task::spawn_blocking(move || {
            let result = cursor.poll(&path);
            (result, cursor, path)
        })
        .await
        .map_err(|e| e.to_string())?;
        let (events, more) = poll.map_err(|e| e.to_string())?;
        cursor = next_cursor;
        path = next_path;
        {
            let mut current = state.current.lock().unwrap();
            if !current.active || current.generation != generation {
                return Ok(());
            }
            for event in events {
                if on_event.send(event).is_err() {
                    current.active = false;
                    return Ok(());
                }
            }
        }
        if !more {
            tokio::time::sleep(TICK).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
        assert!(sub.begin(Some(1)).is_some());
        assert!(sub.begin(Some(12)).is_none());
        assert!(sub.stop(Some(1)));
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
