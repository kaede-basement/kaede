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
    io,
    process::{Command as StdCommand, ExitStatus, Stdio},
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shellx::{process::Command, ShellExt};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    sync::{mpsc, oneshot, watch, Mutex as AsyncMutex},
    task::JoinSet,
    time::Instant,
};

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
    stdin: ProcessInput,
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

enum ManagedEvent {
    Output(OutputPayload),
    Error(ErrorPayload),
    Exit(ExitPayload),
}

fn flush_output(
    emit: &mut impl FnMut(ManagedEvent),
    token: &str,
    pid: u32,
    stdout: &mut Vec<String>,
    stderr: &mut Vec<String>,
) {
    for (stream, pending) in [("stdout", stdout), ("stderr", stderr)] {
        if pending.is_empty() {
            continue;
        }

        emit(ManagedEvent::Output(OutputPayload {
            token: token.to_owned(),
            pid,
            stream,
            lines: std::mem::take(pending),
        }));
    }
}

#[tauri::command]
pub async fn spawn_process(
    app: AppHandle,
    registry: State<'_, ProcessRegistry>,
    spec: SpawnSpec,
) -> Result<ProcessDto, String> {
    let command = build_command(&app, spec.program, spec.args, spec.cwd, spec.env)?;
    let (child, stdin, output) = start_process(command.into(), Drain::Managed).await?;
    let pid = child.id();

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

    let token = spec.token;
    let kind = dto.kind.clone();
    tauri::async_runtime::spawn(async move {
        monitor(
            output,
            app.state::<ProcessRegistry>().inner(),
            pid,
            token,
            kind,
            |event| {
                let _ = match event {
                    ManagedEvent::Output(payload) => app.emit("process-output", payload),
                    ManagedEvent::Error(payload) => app.emit("process-error", payload),
                    ManagedEvent::Exit(payload) => app.emit("process-exited", payload),
                };
            },
        )
        .await;
    });
    Ok(dto)
}

async fn monitor(
    mut output: ProcessOutput,
    registry: &ProcessRegistry,
    pid: u32,
    token: String,
    kind: String,
    mut emit: impl FnMut(ManagedEvent),
) {
    let mut stdout_pending: Vec<String> = Vec::new();
    let mut stderr_pending: Vec<String> = Vec::new();

    let mut interval = tokio::time::interval(TICK);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    let mut pending_bytes = 0;
    let status = loop {
        tokio::select! {
            event = output.next() => match event {
                Record::Line(stream, Ok(bytes)) => {
                    let line = into_line(&bytes);
                    pending_bytes += line.len() + 1;
                    if stream == "stdout" { stdout_pending.push(line); } else { stderr_pending.push(line); }
                    if pending_bytes < 64 * 1024 { continue; }
                }
                Record::Line(_, Err(message)) => {
                    flush_output(&mut emit, &token, pid, &mut stdout_pending, &mut stderr_pending);
                    emit(ManagedEvent::Error(ErrorPayload { token: token.clone(), pid, message }));
                }
                Record::Exit(status) => break status,
            },
            _ = interval.tick(), if pending_bytes > 0 => {}
        }
        flush_output(
            &mut emit,
            &token,
            pid,
            &mut stdout_pending,
            &mut stderr_pending,
        );
        pending_bytes = 0;
    };
    flush_output(
        &mut emit,
        &token,
        pid,
        &mut stdout_pending,
        &mut stderr_pending,
    );
    registry.remove_exited(pid, &token);
    let (code, signal) = match status {
        Ok(status) => {
            #[cfg(unix)]
            let signal = std::os::unix::process::ExitStatusExt::signal(&status);
            #[cfg(not(unix))]
            let signal = None;
            (status.code(), signal)
        }
        Err(message) => {
            emit(ManagedEvent::Error(ErrorPayload {
                token: token.clone(),
                pid,
                message,
            }));
            (None, None)
        }
    };
    emit(ManagedEvent::Exit(ExitPayload {
        token,
        pid,
        kind,
        code,
        signal,
    }));
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
    registry.kill(pid)
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
    stdin
        .write(match &data {
            StdinData::Text(s) => s.as_bytes(),
            StdinData::Bytes(bytes) => bytes,
        })
        .await
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
    collect_output(command.into()).await
}

async fn collect_output(command: StdCommand) -> Result<RunResult, String> {
    let (_child, _stdin, mut output) = start_process(command, Drain::Collect).await?;
    let (mut stdout, mut stderr) = (Vec::new(), Vec::new());
    let status = loop {
        match output.next().await {
            Record::Line(stream, Ok(bytes)) => {
                let dest = if stream == "stdout" {
                    &mut stdout
                } else {
                    &mut stderr
                };
                dest.extend(bytes);
                dest.push(b'\n');
            }
            // Command::output ignores pipe errors and reports an absent code on wait failure.
            Record::Line(_, Err(_)) => (),
            Record::Exit(status) => break status.ok(),
        }
    };
    Ok(RunResult {
        code: status.and_then(|s| s.code()),
        success: status.is_some_and(|s| s.success()),
        stdout: String::from_utf8_lossy(&stdout).into_owned(),
        stderr: String::from_utf8_lossy(&stderr).into_owned(),
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

#[cfg(unix)]
mod pipes {
    use super::*;
    use tokio::net::unix::pipe::{pipe, Receiver, Sender};
    pub type Reader = Receiver;
    pub type Writer = Sender;

    pub fn input() -> io::Result<(Writer, Stdio)> {
        let (tx, rx) = pipe()?;
        Ok((tx, rx.into_blocking_fd()?.into()))
    }

    pub fn output() -> io::Result<(Reader, Stdio)> {
        let (tx, rx) = pipe()?;
        Ok((rx, tx.into_blocking_fd()?.into()))
    }
}

#[cfg(windows)]
mod pipes {
    use super::*;
    use std::{
        fs::OpenOptions,
        sync::atomic::{AtomicU64, Ordering},
    };
    use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};
    pub struct Connected(pub NamedPipeServer);
    pub type Reader = Connected;
    pub type Writer = Connected;

    impl Drop for Connected {
        fn drop(&mut self) {
            // Disconnect before exit notification, even if Mio still owns an in-flight operation.
            let _ = self.0.disconnect();
        }
    }

    // Anonymous Windows pipes use blocking reads even through tokio::process.
    fn pair(inbound: bool) -> io::Result<(Connected, Stdio)> {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let name = format!(
            r"\\.\pipe\kaede-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        );
        let server = ServerOptions::new()
            .access_inbound(inbound)
            .access_outbound(!inbound)
            .first_pipe_instance(true)
            .max_instances(1)
            .create(&name)?;
        // Command duplicates the child endpoint as an inheritable standard handle.
        let client = OpenOptions::new()
            .read(!inbound)
            .write(inbound)
            .open(name)?;
        tokio::runtime::Handle::current().block_on(server.connect())?;
        Ok((Connected(server), client.into()))
    }

    pub fn input() -> io::Result<(Writer, Stdio)> {
        pair(false)
    }
    pub fn output() -> io::Result<(Reader, Stdio)> {
        pair(true)
    }
}

#[derive(Clone)]
struct ProcessInput {
    pipe: Arc<AsyncMutex<pipes::Writer>>,
    exited: watch::Receiver<()>,
}

impl ProcessInput {
    async fn write(mut self, bytes: &[u8]) -> io::Result<()> {
        tokio::select! {
            biased;
            _ = self.exited.changed() => Err(io::ErrorKind::BrokenPipe.into()),
            result = async {
                let mut pipe = self.pipe.lock().await;
                #[cfg(unix)]
                { pipe.write_all(bytes).await }
                #[cfg(windows)]
                {
                    // Mio copies a whole submitted buffer when an overlapped write is pending.
                    const WRITE_CHUNK: usize = 16 * 1024;
                    for chunk in bytes.chunks(WRITE_CHUNK) {
                        pipe.0.write_all(chunk).await?;
                    }
                    Ok(())
                }
            } => result,
        }
    }
}

type Status = Result<ExitStatus, String>;
type OutputLine = (&'static str, Result<Vec<u8>, String>);
const PIPE_DRAIN: Duration = Duration::from_millis(200);

enum Record {
    Line(&'static str, Result<Vec<u8>, String>),
    Exit(Status),
}

enum Drain {
    // Managed exit notifications have a bounded grace period for inherited pipes.
    Managed,
    // shellx collection waits for EOF, including output from surviving descendants.
    Collect,
}

enum Lifecycle {
    Running(oneshot::Receiver<io::Result<ExitStatus>>),
    Draining {
        status: Status,
        deadline: Option<Instant>,
    },
    Finished(Status),
}

struct ProcessOutput {
    readers: JoinSet<()>,
    lines: mpsc::Receiver<OutputLine>,
    state: Lifecycle,
    drain: Drain,
}

async fn start_process(
    mut command: StdCommand,
    drain: Drain,
) -> Result<(Arc<SharedChild>, ProcessInput, ProcessOutput), String> {
    tokio::task::spawn_blocking(move || -> io::Result<_> {
        let (stdin, input) = pipes::input()?;
        let (stdout, out) = pipes::output()?;
        let (stderr, err) = pipes::output()?;
        let child = Arc::new(SharedChild::spawn(
            command.stdin(input).stdout(out).stderr(err),
        )?);
        let (done, exit) = oneshot::channel();
        let (alive, exited) = watch::channel(());
        let waiter = child.clone();
        if let Err(error) = std::thread::Builder::new()
            .name("child-wait".into())
            .spawn(move || {
                let status = waiter.wait();
                drop(alive);
                let _ = done.send(status);
            })
        {
            child.kill()?;
            child.wait()?;
            return Err(error);
        }

        let (tx, lines) = mpsc::channel(32);
        let mut readers = JoinSet::new();
        readers.spawn(read_pipe(stdout, tx.clone(), "stdout"));
        readers.spawn(read_pipe(stderr, tx, "stderr"));
        Ok((
            child,
            ProcessInput {
                pipe: Arc::new(AsyncMutex::new(stdin)),
                exited,
            },
            ProcessOutput {
                readers,
                lines,
                state: Lifecycle::Running(exit),
                drain,
            },
        ))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

impl ProcessOutput {
    async fn next(&mut self) -> Record {
        loop {
            match &mut self.state {
                Lifecycle::Running(exit) => {
                    let status = tokio::select! {
                        biased;
                        status = &mut *exit => status,
                        line = self.lines.recv() => match line {
                            Some((stream, line)) => return Record::Line(stream, line),
                            None => exit.await,
                        },
                    };
                    let status = status
                        .map_err(|e| e.to_string())
                        .and_then(|s| s.map_err(|e| e.to_string()));
                    let deadline = match self.drain {
                        Drain::Managed => Some(Instant::now() + PIPE_DRAIN),
                        Drain::Collect => None,
                    };
                    self.state = Lifecycle::Draining { status, deadline };
                }
                Lifecycle::Draining { status, deadline } => {
                    let line = match deadline {
                        Some(deadline) => tokio::select! {
                            biased;
                            _ = tokio::time::sleep_until(*deadline) => None,
                            line = self.lines.recv() => line,
                        },
                        None => self.lines.recv().await,
                    };
                    if let Some((stream, line)) = line {
                        return Record::Line(stream, line);
                    }
                    self.lines.close();
                    self.readers.abort_all();
                    self.state = Lifecycle::Finished(status.clone());
                }
                Lifecycle::Finished(status) => {
                    if let Ok((stream, line)) = self.lines.try_recv() {
                        return Record::Line(stream, line);
                    }
                    // Task cancellation (and hence pipe closure) completes before exit delivery.
                    while self.readers.join_next().await.is_some() {}
                    return Record::Exit(status.clone());
                }
            }
        }
    }
}

async fn read_pipe(mut pipe: pipes::Reader, tx: mpsc::Sender<OutputLine>, stream: &'static str) {
    #[cfg(windows)]
    let pipe = &mut pipe.0;
    #[cfg(unix)]
    let pipe = &mut pipe;
    let mut reader = BufReader::new(pipe);
    loop {
        let mut bytes = Vec::new();
        let record = loop {
            match reader.fill_buf().await {
                Ok([]) if bytes.is_empty() => return,
                Ok([]) => break Ok(bytes),
                Ok(mut chunk) => {
                    // Use Tauri's LF-before-CR rule on exactly one available buffer.
                    let n = tauri::utils::io::read_line(&mut chunk, &mut bytes)
                        .expect("reading an in-memory slice cannot fail");
                    reader.consume(n);
                    if matches!(bytes.last(), Some(b'\r' | b'\n')) {
                        break Ok(bytes);
                    }
                }
                Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
                Err(e) => break Err(e.to_string()),
            }
        };
        let failed = record.is_err();
        if tx.send((stream, record)).await.is_err() || failed {
            return;
        }
    }
}

impl ProcessRegistry {
    fn kill(&self, pid: u32) -> Result<(), String> {
        let child = self
            .0
            .lock()
            .unwrap()
            .get(&pid)
            .map(|entry| entry.child.clone())
            .ok_or_else(|| format!("no managed process with pid {pid}"))?;
        child.kill().map_err(|e| e.to_string())
    }

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpStream,
    };
    use tokio::{io::AsyncReadExt, net::TcpListener, time::timeout};

    fn fixture(mode: &str) -> StdCommand {
        let mut command = StdCommand::new(std::env::current_exe().unwrap());
        command
            .args([
                "--exact",
                "processes::tests::process_fixture",
                "--ignored",
                "--nocapture",
            ])
            .env("KAEDE_PROCESS_FIXTURE", mode);
        command
    }

    #[test]
    #[ignore = "invoked in a separate process by the process lifecycle tests"]
    fn process_fixture() {
        match std::env::var("KAEDE_PROCESS_FIXTURE").unwrap().as_str() {
            "child" => {
                let mut control =
                    TcpStream::connect(std::env::var("KAEDE_TEST_CONTROL").unwrap()).unwrap();
                control
                    .set_read_timeout(Some(Duration::from_secs(20)))
                    .unwrap();
                let _grandchild = fixture("grandchild").spawn().unwrap();
                control.read_exact(&mut [0]).unwrap();
                eprintln!("final stderr");
                std::process::exit(7);
            }
            "grandchild" => {
                let mut control =
                    TcpStream::connect(std::env::var("KAEDE_TEST_CONTROL").unwrap()).unwrap();
                control
                    .set_read_timeout(Some(Duration::from_secs(20)))
                    .unwrap();
                let mut request = [0];
                if control.read_exact(&mut request).is_ok() {
                    let out = io::stdout().write_all(b"probe\n");
                    let err = io::stderr().write_all(b"probe\n");
                    control
                        .write_all(&[out.is_err() as u8, err.is_err() as u8])
                        .unwrap();
                    let _ = control.read(&mut request);
                }
            }
            "idle" => std::thread::sleep(Duration::from_secs(15)),
            "records" => io::stderr().write_all(b"a\rb\r\nc\xff\nend\rtail").unwrap(),
            mode => panic!("unexpected fixture {mode}"),
        }
        std::process::exit(0);
    }

    #[tokio::test]
    async fn managed_exit_closes_both_inherited_pipes() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let mut cmd = fixture("child");
        cmd.env(
            "KAEDE_TEST_CONTROL",
            listener.local_addr().unwrap().to_string(),
        );
        let (child, stdin, output) = start_process(cmd, Drain::Managed).await.unwrap();
        let pid = child.id();
        let registry = ProcessRegistry::default();
        registry.0.lock().unwrap().insert(
            pid,
            ProcessEntry {
                token: "current".into(),
                kind: "test".into(),
                meta: Value::Null,
                stdin,
                child,
            },
        );
        registry.remove_exited(pid, "older");
        assert!(registry.0.lock().unwrap().contains_key(&pid));

        timeout(Duration::from_secs(10), async {
            let (mut direct, _) = listener.accept().await.unwrap();
            let (mut control, _) = listener.accept().await.unwrap();
            direct.write_all(&[1]).await.unwrap();
            let mut final_line = false;
            let mut exited = false;
            monitor(
                output,
                &registry,
                pid,
                "current".into(),
                "test".into(),
                |event| {
                    assert!(!exited);
                    match event {
                        ManagedEvent::Output(batch) if batch.stream == "stderr" => {
                            final_line |= batch.lines.iter().any(|line| line == "final stderr")
                        }
                        ManagedEvent::Output(_) => (),
                        ManagedEvent::Error(e) => panic!("{}", e.message),
                        ManagedEvent::Exit(exit) => {
                            assert!(final_line);
                            assert_eq!(exit.code, Some(7));
                            assert!(registry.0.lock().unwrap().is_empty());
                            exited = true;
                        }
                    }
                },
            )
            .await;
            assert!(exited);
            control.write_all(&[1]).await.unwrap();
            let mut errors = [0; 2];
            control.read_exact(&mut errors).await.unwrap();
            assert_eq!(errors, [1, 1]);
            control.shutdown().await.unwrap();
            assert_eq!(control.read(&mut [0]).await.unwrap(), 0);
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn collection_keeps_delimiters_and_appends_lf_per_record() {
        let result = collect_output(fixture("records")).await.unwrap();
        assert!(result.success);
        assert_eq!(result.stderr, "a\rb\r\n\nc�\n\nend\r\ntail\n");
    }

    #[tokio::test]
    async fn collection_keeps_inherited_pipes_until_eof() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let mut cmd = fixture("child");
        cmd.env(
            "KAEDE_TEST_CONTROL",
            listener.local_addr().unwrap().to_string(),
        );
        timeout(Duration::from_secs(10), async {
            let mut collect = tokio::spawn(collect_output(cmd));
            let (mut direct, _) = listener.accept().await.unwrap();
            let (mut grandchild, _) = listener.accept().await.unwrap();
            direct.write_all(&[1]).await.unwrap();
            assert_eq!(direct.read(&mut [0]).await.unwrap(), 0);
            assert!(timeout(PIPE_DRAIN * 2, &mut collect).await.is_err());
            grandchild.write_all(&[1]).await.unwrap();
            let mut errors = [1; 2];
            grandchild.read_exact(&mut errors).await.unwrap();
            assert_eq!(errors, [0, 0]);
            grandchild.shutdown().await.unwrap();
            let result = collect.await.unwrap().unwrap();
            assert_eq!(result.code, Some(7));
            assert!(result.stdout.ends_with("probe\n\n"));
            assert_eq!(result.stderr, "final stderr\n\nprobe\n\n");
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn kill_interrupts_backpressured_stdin() {
        let (child, stdin, mut output) = start_process(fixture("idle"), Drain::Managed)
            .await
            .unwrap();
        let bytes = vec![0; 8 << 20];
        let pid = child.id();
        let registry = ProcessRegistry::default();
        registry.0.lock().unwrap().insert(
            pid,
            ProcessEntry {
                token: "current".into(),
                kind: "test".into(),
                meta: Value::Null,
                stdin: stdin.clone(),
                child,
            },
        );
        let write = stdin.write(&bytes);
        tokio::pin!(write);
        assert!(timeout(Duration::from_millis(100), &mut write)
            .await
            .is_err());
        registry.kill(pid).unwrap();
        timeout(Duration::from_secs(5), async {
            assert!(write.await.is_err());
            while let Record::Line(..) = output.next().await {}
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn expired_drain_delivers_queued_lines() {
        let (tx, lines) = mpsc::channel(2);
        tx.try_send(("stdout", Ok(vec![1]))).unwrap();
        tx.try_send(("stderr", Ok(vec![2]))).unwrap();
        let mut output = ProcessOutput {
            readers: JoinSet::new(),
            lines,
            drain: Drain::Managed,
            state: Lifecycle::Draining {
                status: Err("wait".into()),
                deadline: Some(Instant::now() - PIPE_DRAIN),
            },
        };
        assert!(matches!(output.next().await, Record::Line("stdout", Ok(_))));
        assert!(tx.is_closed());
        assert!(matches!(output.next().await, Record::Line("stderr", Ok(_))));
        assert!(matches!(output.next().await, Record::Exit(Err(_))));
    }
}
