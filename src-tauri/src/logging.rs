use same_file::Handle;
use serde::Serialize;
///
/// ATTENTION: AI-generated (by Qwen 3.8-Max and Claude Fable 5 on 'max' reasoning)
///
use std::{
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
}

impl Subscription {
    fn begin(&mut self, viewer: Option<u64>) -> u64 {
        self.generation += 1;
        self.viewer = viewer;
        self.active = true;
        self.generation
    }

    fn stop(&mut self, viewer: Option<u64>) -> bool {
        if self.active && self.viewer == viewer {
            self.active = false;
            true
        } else {
            false
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
            let mut rest = &bytes[..n];
            while let Some(end) = rest.iter().position(|b| *b == b'\n') {
                self.partial.extend_from_slice(&rest[..end]);
                let line = self.partial.strip_suffix(b"\r").unwrap_or(&self.partial);
                lines.push(String::from_utf8_lossy(line).into_owned());
                self.partial.clear();
                rest = &rest[end + 1..];
            }
            self.partial.extend_from_slice(rest);
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
    let generation = state.current.lock().unwrap().begin(subscription_id);
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
