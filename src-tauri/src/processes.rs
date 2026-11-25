///
/// ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning)
///
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use shared_child::SharedChild;
use std::{
    io::{BufReader, Read, Write},
    process::ChildStdin,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shellx::{process::Command, ShellExt};
use tokio::sync::{mpsc, Mutex as AsyncMutex};

const TICK: Duration = Duration::from_millis(100);

#[derive(Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum Program {
    // Command#create equivalent
    Path(String),
    // Command#sidecar equivalent
    Sidecar(String),
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnSpec {
    token: String,
    program: Program,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    cwd: Option<PathBuf>,
    #[serde(default)]
    env: Option<HashMap<String, String>>,
    kind: String,
    #[serde(default)]
    meta: Value,
}

struct ProcessEntry {
    token: String,
    kind: String,
    meta: Value,
    child: Arc<SharedChild>,
    stdin: Arc<AsyncMutex<ChildStdin>>,
}

#[derive(Default)]
pub struct ProcessRegistry(Mutex<HashMap<u32, ProcessEntry>>);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDto {
    token: String,
    pid: u32,
    kind: String,
    meta: Value,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct OutputPayload {
    token: String,
    pid: u32,
    stream: &'static str,
    lines: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ErrorPayload {
    token: String,
    pid: u32,
    message: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ExitPayload {
    token: String,
    pid: u32,
    kind: String,
    code: Option<i32>,
    signal: Option<i32>,
}

fn into_line(bytes: &[u8]) -> String {
    let mut line = String::from_utf8_lossy(bytes).into_owned();
    line.truncate(line.trim_end_matches(['\r', '\n']).len());
    line
}

fn flush_output(
    app: &AppHandle,
    token: &str,
    pid: u32,
    stdout: &mut Vec<String>,
    stderr: &mut Vec<String>,
) {
    for (stream, pending) in [("stdout", stdout), ("stderr", stderr)] {
        if pending.is_empty() {
            continue;
        }

        let _ = app.emit(
            "process-output",
            OutputPayload {
                token: token.to_owned(),
                pid,
                stream,
                lines: std::mem::take(pending),
            },
        );
    }
}

#[tauri::command]
pub async fn spawn_process(
    app: AppHandle,
    registry: State<'_, ProcessRegistry>,
    spec: SpawnSpec,
) -> Result<ProcessDto, String> {
    let command = build_command(&app, spec.program, spec.args, spec.cwd, spec.env)?;
    let child = Arc::new(SharedChild::spawn(&mut command.into()).map_err(|e| e.to_string())?);
    let pid = child.id();
    let stdin = Arc::new(AsyncMutex::new(child.take_stdin().expect("piped stdin")));
    let (tx, mut rx) = mpsc::channel(1);
    let stdout = read_pipe(
        child.take_stdout().expect("piped stdout"),
        tx.clone(),
        "stdout",
    );
    let stderr = read_pipe(child.take_stderr().expect("piped stderr"), tx, "stderr");
    let waiter = child.clone();
    let exit = tokio::task::spawn_blocking(move || waiter.wait());

    let dto = ProcessDto {
        token: spec.token.clone(),
        pid,
        kind: spec.kind.clone(),
        meta: spec.meta.clone(),
    };

    registry.0.lock().unwrap().insert(
        pid,
        ProcessEntry {
            token: spec.token.clone(),
            kind: spec.kind,
            meta: spec.meta,
            child,
            stdin,
        },
    );

    let (token, kind, app) = (spec.token, dto.kind.clone(), app.clone());
    tauri::async_runtime::spawn(async move {
        let mut stdout_pending: Vec<String> = Vec::new();
        let mut stderr_pending: Vec<String> = Vec::new();

        let mut interval = tokio::time::interval(TICK);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        let mut pending_bytes = 0;
        loop {
            tokio::select! {
                event = rx.recv() => match event {
                    Some((stream, Ok(line))) => {
                        pending_bytes += line.len() + 1;
                        if stream == "stdout" { stdout_pending.push(line); } else { stderr_pending.push(line); }
                        if pending_bytes < 64 * 1024 { continue; }
                    }
                    Some((_, Err(message))) => {
                        flush_output(&app, &token, pid, &mut stdout_pending, &mut stderr_pending);
                        let _ = app.emit("process-error", ErrorPayload { token: token.clone(), pid, message });
                    }
                    None => break,
                },
                _ = interval.tick(), if pending_bytes > 0 => {}
            }
            flush_output(&app, &token, pid, &mut stdout_pending, &mut stderr_pending);
            pending_bytes = 0;
        }
        flush_output(&app, &token, pid, &mut stdout_pending, &mut stderr_pending);
        for reader in [stdout, stderr] {
            if let Err(e) = reader.await {
                let _ = app.emit(
                    "process-error",
                    ErrorPayload {
                        token: token.clone(),
                        pid,
                        message: e.to_string(),
                    },
                );
            }
        }
        let status = exit
            .await
            .map_err(|e| e.to_string())
            .and_then(|s| s.map_err(|e| e.to_string()));
        app.state::<ProcessRegistry>().remove_exited(pid, &token);
        let (code, signal) = match status {
            Ok(status) => {
                #[cfg(unix)]
                let signal = std::os::unix::process::ExitStatusExt::signal(&status);
                #[cfg(not(unix))]
                let signal = None;
                (status.code(), signal)
            }
            Err(message) => {
                let _ = app.emit(
                    "process-error",
                    ErrorPayload {
                        token: token.clone(),
                        pid,
                        message,
                    },
                );
                (None, None)
            }
        };
        let _ = app.emit(
            "process-exited",
            ExitPayload {
                token,
                pid,
                kind,
                code,
                signal,
            },
        );
    });

    Ok(dto)
}

#[tauri::command]
pub fn list_processes(registry: State<'_, ProcessRegistry>) -> Vec<ProcessDto> {
    registry
        .0
        .lock()
        .unwrap()
        .iter()
        .map(|(pid, e)| ProcessDto {
            token: e.token.clone(),
            pid: *pid,
            kind: e.kind.clone(),
            meta: e.meta.clone(),
        })
        .collect()
}

#[tauri::command]
pub fn kill_process(registry: State<'_, ProcessRegistry>, pid: u32) -> Result<(), String> {
    let child = registry
        .0
        .lock()
        .unwrap()
        .get(&pid)
        .map(|entry| entry.child.clone())
        .ok_or_else(|| format!("no managed process with pid {pid}"))?;
    child.kill().map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(untagged)]
pub enum StdinData {
    Text(String),
    Bytes(Vec<u8>),
}

#[tauri::command]
pub async fn write_process(
    registry: State<'_, ProcessRegistry>,
    pid: u32,
    data: StdinData,
) -> Result<(), String> {
    let stdin = registry
        .0
        .lock()
        .unwrap()
        .get(&pid)
        .map(|entry| entry.stdin.clone())
        .ok_or_else(|| format!("no managed process with pid {pid}"))?;
    let mut stdin = stdin.lock_owned().await;
    tokio::task::spawn_blocking(move || match data {
        StdinData::Text(s) => stdin.write_all(s.as_bytes()),
        StdinData::Bytes(b) => stdin.write_all(&b),
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSpec {
    program: Program,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    cwd: Option<PathBuf>,
    #[serde(default)]
    env: Option<HashMap<String, String>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    code: Option<i32>,
    success: bool,
    stdout: String,
    stderr: String,
}

#[tauri::command]
pub async fn run_process(app: AppHandle, spec: RunSpec) -> Result<RunResult, String> {
    let command = build_command(&app, spec.program, spec.args, spec.cwd, spec.env)?;
    let output = command.output().await.map_err(|e| e.to_string())?;

    Ok(RunResult {
        code: output.status.code(),
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

fn build_command(
    app: &AppHandle,
    program: Program,
    args: Vec<String>,
    cwd: Option<PathBuf>,
    env: Option<HashMap<String, String>>,
) -> Result<Command, String> {
    let mut command = match program {
        Program::Path(program) => app.shell().command(program),
        Program::Sidecar(name) => app.shell().sidecar(name).map_err(|e| e.to_string())?,
    }
    .args(args);
    if let Some(cwd) = cwd {
        command = command.current_dir(cwd);
    }
    if let Some(env) = env {
        command = command.envs(env);
    }
    Ok(command)
}

type OutputLine = (&'static str, Result<String, String>);

fn read_pipe(
    pipe: impl Read + Send + 'static,
    tx: mpsc::Sender<OutputLine>,
    stream: &'static str,
) -> tokio::task::JoinHandle<()> {
    tokio::task::spawn_blocking(move || {
        let mut reader = BufReader::new(pipe);
        let mut bytes = Vec::new();
        loop {
            bytes.clear();
            let line = match tauri::utils::io::read_line(&mut reader, &mut bytes) {
                Ok(0) => break,
                Ok(_) => Ok(into_line(&bytes)),
                Err(e) => Err(e.to_string()),
            };
            let failed = line.is_err();
            if tx.blocking_send((stream, line)).is_err() || failed {
                break;
            }
        }
    })
}

impl ProcessRegistry {
    fn remove_exited(&self, pid: u32, token: &str) {
        let mut processes = self.0.lock().unwrap();
        if processes
            .get(&pid)
            .is_some_and(|entry| entry.token == token)
        {
            processes.remove(&pid);
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    #[test]
    fn only_matching_exit_removes_process() {
        let mut cmd = std::process::Command::new("sh");
        cmd.args(["-c", "exit 0"])
            .stdin(std::process::Stdio::piped());
        let child = Arc::new(SharedChild::spawn(&mut cmd).unwrap());
        let pid = child.id();
        let registry = ProcessRegistry::default();
        registry.0.lock().unwrap().insert(
            pid,
            ProcessEntry {
                token: "new".into(),
                kind: "test".into(),
                meta: Value::Null,
                stdin: Arc::new(AsyncMutex::new(child.take_stdin().unwrap())),
                child: child.clone(),
            },
        );
        child.wait().unwrap();
        registry.remove_exited(pid, "old");
        assert!(registry.0.lock().unwrap().contains_key(&pid));
        registry.remove_exited(pid, "new");
        assert!(registry.0.lock().unwrap().is_empty());
    }
}
