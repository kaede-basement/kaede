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
    sync::{mpsc, oneshot, watch, Mutex as AsyncMutex},
    time::Instant,
};

#[cfg(any(unix, test))]
use tokio::task::JoinSet;

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
    let (launch, stdin, output) = start_process(command.into(), Drain::Managed).await?;
    let child = launch.transfer();
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
        .write(match data {
            StdinData::Text(s) => s.into_bytes(),
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
    collect_child(start_process(command, Drain::Collect).await?).await
}

async fn collect_child(
    (launch, _stdin, mut output): (LaunchGuard, ProcessInput, ProcessOutput),
) -> Result<RunResult, String> {
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
    if status.is_some() {
        launch.transfer();
    }
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
    use tokio::io::AsyncWriteExt;
    use tokio::net::unix::pipe::{pipe, Receiver, Sender};
    pub type Exit = tokio::sync::watch::Receiver<()>;

    pub fn exit_signal() -> io::Result<(Exit, impl FnOnce())> {
        let (alive, exited) = tokio::sync::watch::channel(());
        Ok((exited, move || drop(alive)))
    }

    pub async fn write_all(
        mut pipe: tokio::sync::OwnedMutexGuard<Writer>,
        bytes: Vec<u8>,
        mut exited: Exit,
    ) -> io::Result<()> {
        tokio::select! {
            biased;
            _ = exited.changed() => Err(io::ErrorKind::BrokenPipe.into()),
            result = pipe.write_all(&bytes) => result,
        }
    }
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
        cell::UnsafeCell,
        collections::VecDeque,
        fs::{File, OpenOptions},
        mem::{size_of, size_of_val, MaybeUninit},
        os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle},
        ptr::{null, null_mut},
    };
    use windows_sys::Win32::{
        Foundation::{
            ERROR_IO_PENDING, ERROR_OPERATION_ABORTED, ERROR_PIPE_CONNECTED, GENERIC_ALL, HANDLE,
            INVALID_HANDLE_VALUE, WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT,
        },
        Security::{
            AddAccessAllowedAce, GetTokenInformation, InitializeAcl, InitializeSecurityDescriptor,
            SetSecurityDescriptorDacl, TokenUser, ACCESS_ALLOWED_ACE, ACL, ACL_REVISION,
            SECURITY_ATTRIBUTES, SECURITY_DESCRIPTOR, SECURITY_MAX_SID_SIZE, TOKEN_QUERY,
            TOKEN_USER,
        },
        Storage::FileSystem::{
            ReadFile, WriteFile, FILE_FLAG_FIRST_PIPE_INSTANCE, FILE_FLAG_OVERLAPPED,
            PIPE_ACCESS_INBOUND, PIPE_ACCESS_OUTBOUND,
        },
        System::{
            Pipes::{
                ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, PIPE_REJECT_REMOTE_CLIENTS,
            },
            SystemServices::SECURITY_DESCRIPTOR_REVISION,
            Threading::{
                CreateEventW, GetCurrentProcess, OpenProcessToken, SetEvent,
                WaitForMultipleObjects, WaitForSingleObject, INFINITE,
            },
            IO::{CancelIoEx, GetOverlappedResult, OVERLAPPED},
        },
    };

    pub type Writer = OwnedHandle;

    fn checked(ok: i32) -> io::Result<()> {
        if ok == 0 {
            Err(io::Error::last_os_error())
        } else {
            Ok(())
        }
    }

    fn private_server(inbound: bool) -> io::Result<(String, OwnedHandle)> {
        const MAX_USER: usize = size_of::<TOKEN_USER>() + SECURITY_MAX_SID_SIZE as usize;
        const MAX_ACL: usize =
            size_of::<ACL>() + size_of::<ACCESS_ALLOWED_ACE>() + SECURITY_MAX_SID_SIZE as usize;
        // TOKEN_USER and ACL have variable-size SID tails. Back them with aligned storage.
        let mut user = [0usize; MAX_USER.div_ceil(size_of::<usize>())];
        let mut acl = [0u32; MAX_ACL.div_ceil(size_of::<u32>())];
        let mut descriptor = MaybeUninit::<SECURITY_DESCRIPTOR>::uninit();
        let descriptor = descriptor.as_mut_ptr().cast();
        unsafe {
            let mut token = null_mut();
            checked(OpenProcessToken(
                GetCurrentProcess(),
                TOKEN_QUERY,
                &mut token,
            ))?;
            let token = OwnedHandle::from_raw_handle(token);
            checked(GetTokenInformation(
                token.as_raw_handle(),
                TokenUser,
                user.as_mut_ptr().cast(),
                size_of_val(&user) as u32,
                &mut 0,
            ))?;
            let sid = (*user.as_ptr().cast::<TOKEN_USER>()).User.Sid;
            let len = size_of_val(&acl) as u32;
            let acl = acl.as_mut_ptr().cast();
            checked(InitializeAcl(acl, len, ACL_REVISION))?;
            checked(AddAccessAllowedAce(acl, ACL_REVISION, GENERIC_ALL, sid))?;
            checked(InitializeSecurityDescriptor(
                descriptor,
                SECURITY_DESCRIPTOR_REVISION,
            ))?;
            checked(SetSecurityDescriptorDacl(descriptor, 1, acl, 0))?;
        }
        let attrs = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor,
            bInheritHandle: 0,
        };
        let mut retried_denial = false;
        loop {
            let mut random = [0; 16];
            getrandom::getrandom(&mut random)?;
            let name = format!(r"\\.\pipe\kaede-{:032x}", u128::from_ne_bytes(random));
            // The descriptor and its sole user ACE live through CreateNamedPipeW.
            let wide: Vec<_> = name.encode_utf16().chain(Some(0)).collect();
            let mode = if inbound {
                PIPE_ACCESS_INBOUND
            } else {
                PIPE_ACCESS_OUTBOUND
            };
            const PIPE_CAPACITY: u32 = 64 * 1024;
            let handle = unsafe {
                CreateNamedPipeW(
                    wide.as_ptr(),
                    mode | FILE_FLAG_FIRST_PIPE_INSTANCE | FILE_FLAG_OVERLAPPED,
                    PIPE_REJECT_REMOTE_CLIENTS,
                    1,
                    PIPE_CAPACITY,
                    PIPE_CAPACITY,
                    0,
                    &attrs,
                )
            };
            let result = if handle == INVALID_HANDLE_VALUE {
                Err(io::Error::last_os_error())
            } else {
                Ok(unsafe { OwnedHandle::from_raw_handle(handle) })
            };
            match result {
                Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
                // FIRST_PIPE_INSTANCE also reports a collision as access denied.
                // Retry with a fresh name once so a persistent access denial is returned.
                Err(e) if e.kind() == io::ErrorKind::PermissionDenied && !retried_denial => {
                    retried_denial = true;
                }
                result => return Ok((name, result?)),
            }
        }
    }

    fn pair(inbound: bool) -> io::Result<(OwnedHandle, File)> {
        let (name, server) = private_server(inbound)?;
        let client = OpenOptions::new()
            .read(!inbound)
            .write(inbound)
            .open(name)?;
        let event = event(true)?;
        let mut operation: OVERLAPPED = unsafe { std::mem::zeroed() };
        operation.hEvent = event.as_raw_handle();
        if unsafe { ConnectNamedPipe(server.as_raw_handle(), &mut operation) } == 0 {
            let err = io::Error::last_os_error();
            match err.raw_os_error() {
                Some(code) if code == ERROR_PIPE_CONNECTED as i32 => (),
                Some(code) if code == ERROR_IO_PENDING as i32 => {
                    finish_overlapped(server.as_raw_handle(), &mut operation, false)?;
                }
                _ => return Err(err),
            }
        }
        Ok((server, client))
    }

    pub fn input() -> io::Result<(Writer, Stdio)> {
        let (server, client) = pair(false)?;
        Ok((server, client.into()))
    }
    pub fn output() -> io::Result<(OwnedHandle, Stdio)> {
        pair(true).map(|(server, client)| (server, client.into()))
    }

    fn event(manual_reset: bool) -> io::Result<OwnedHandle> {
        let handle = unsafe { CreateEventW(null(), manual_reset.into(), 0, null()) };
        if handle.is_null() {
            return Err(io::Error::last_os_error());
        }
        Ok(unsafe { OwnedHandle::from_raw_handle(handle) })
    }

    pub type Exit = Arc<OwnedHandle>;

    pub fn exit_signal() -> io::Result<(Exit, impl FnOnce())> {
        let exited = Arc::new(event(true)?);
        let signal = exited.clone();
        Ok((exited, move || unsafe {
            SetEvent(signal.as_raw_handle());
        }))
    }

    struct CancelWrite(Arc<OwnedHandle>);

    impl Drop for CancelWrite {
        fn drop(&mut self) {
            // Also releases the blocking task if the Tauri invocation is abandoned.
            unsafe {
                SetEvent(self.0.as_raw_handle());
            }
        }
    }

    fn write_blocking(
        writer: &Writer,
        mut bytes: &[u8],
        exited: &OwnedHandle,
        cancel: &OwnedHandle,
    ) -> io::Result<()> {
        let event = event(true)?;
        let handles = [
            event.as_raw_handle(),
            exited.as_raw_handle(),
            cancel.as_raw_handle(),
        ];
        let pipe = writer.as_raw_handle();
        while !bytes.is_empty() {
            match unsafe { WaitForMultipleObjects(2, handles[1..].as_ptr(), 0, 0) } {
                WAIT_TIMEOUT => (),
                WAIT_FAILED => return Err(io::Error::last_os_error()),
                _ => return Err(io::ErrorKind::BrokenPipe.into()),
            }
            let mut operation: OVERLAPPED = unsafe { std::mem::zeroed() };
            operation.hEvent = handles[0];
            let operation = std::ptr::addr_of_mut!(operation);
            let size = bytes.len().min(u32::MAX as usize) as u32;
            let mut written = 0;
            let issued = unsafe { WriteFile(pipe, bytes.as_ptr(), size, &mut written, operation) };
            let mut wait_error = None;
            let mut cancel = false;
            if issued == 0 {
                let err = io::Error::last_os_error();
                if err.raw_os_error() != Some(ERROR_IO_PENDING as i32) {
                    return Err(err);
                }
                // Win32 chooses the first signaled handle, so completion wins ties.
                let wake = unsafe {
                    WaitForMultipleObjects(handles.len() as u32, handles.as_ptr(), 0, INFINITE)
                };
                wait_error = (wake == WAIT_FAILED).then(io::Error::last_os_error);
                cancel = wake != WAIT_OBJECT_0;
            }
            // Always finish the operation before releasing its buffer or stack storage.
            let result = finish_overlapped(pipe, operation, cancel);
            if let Some(err) = wait_error {
                return Err(err);
            }
            let written = match result {
                Err(err) if err.raw_os_error() == Some(ERROR_OPERATION_ABORTED as i32) => {
                    return Err(io::ErrorKind::BrokenPipe.into());
                }
                result => result?,
            };
            if written == 0 {
                return Err(io::ErrorKind::WriteZero.into());
            }
            bytes = &bytes[written..];
        }
        Ok(())
    }

    pub async fn write_all(
        pipe: tokio::sync::OwnedMutexGuard<Writer>,
        bytes: Vec<u8>,
        exited: Exit,
    ) -> io::Result<()> {
        let cancel = Arc::new(event(true)?);
        let _signal_on_drop = CancelWrite(cancel.clone());
        tokio::task::spawn_blocking(move || write_blocking(&pipe, &bytes, &exited, &cancel))
            .await
            .map_err(io::Error::other)?
    }

    // The operation and its buffer must remain alive until this returns, even if
    // cancellation loses the race to a successful kernel completion.
    fn finish_overlapped(
        handle: HANDLE,
        operation: *mut OVERLAPPED,
        cancel: bool,
    ) -> io::Result<usize> {
        let mut transferred = 0;
        unsafe {
            if cancel {
                CancelIoEx(handle, operation);
            }
            checked(GetOverlappedResult(handle, operation, &mut transferred, 1))?;
        }
        Ok(transferred as usize)
    }

    struct ReadStream {
        name: &'static str,
        handle: Option<OwnedHandle>,
        event: OwnedHandle,
        operation: Box<UnsafeCell<OVERLAPPED>>,
        buffer: Box<UnsafeCell<[u8; READ_BUFFER]>>,
        pending: bool,
        parser: LineParser,
        outbox: VecDeque<OutputLine>,
    }

    impl ReadStream {
        fn new(name: &'static str, handle: OwnedHandle, event: OwnedHandle, drain: Drain) -> Self {
            Self {
                name,
                handle: Some(handle),
                event,
                operation: Box::new(UnsafeCell::new(unsafe { std::mem::zeroed() })),
                buffer: Box::new(UnsafeCell::new([0; READ_BUFFER])),
                pending: false,
                parser: LineParser::new(drain),
                outbox: VecDeque::new(),
            }
        }

        fn parse(&mut self, count: usize) {
            // Only accessed after GetOverlappedResult has retired the operation.
            let mut chunk = &self.buffer.get_mut()[..count];
            while let Some(record) = self.parser.next(&mut chunk) {
                self.outbox.push_back((self.name, Ok(record)));
            }
        }

        fn close(&mut self, error: Option<io::Error>) {
            if let Some(handle) = self.handle.take() {
                unsafe {
                    DisconnectNamedPipe(handle.as_raw_handle());
                }
            }
            if let Some(tail) = self.parser.finish(error.is_some()) {
                self.outbox.push_back((self.name, Ok(tail)));
            }
            if let Some(error) = error {
                self.outbox.push_back((self.name, Err(error.to_string())));
            }
        }

        fn result(&mut self, result: io::Result<usize>, cancelling: bool) {
            match result {
                Ok(count) => self.parse(count),
                Err(e)
                    if e.kind() == io::ErrorKind::BrokenPipe
                        || (cancelling
                            && e.raw_os_error() == Some(ERROR_OPERATION_ABORTED as i32)) =>
                {
                    self.close(None)
                }
                Err(e) => self.close(Some(e)),
            }
        }

        fn finish_read(&mut self, cancel: bool) {
            let result = finish_overlapped(
                self.handle.as_ref().unwrap().as_raw_handle(),
                self.operation.get(),
                cancel,
            );
            self.pending = false;
            self.result(result, cancel);
        }

        fn submit(&mut self) {
            let handle = self.handle.as_ref().unwrap().as_raw_handle();
            let mut operation: OVERLAPPED = unsafe { std::mem::zeroed() };
            operation.hEvent = self.event.as_raw_handle();
            *self.operation.get_mut() = operation;
            let issued = unsafe {
                ReadFile(
                    handle,
                    self.buffer.get().cast(),
                    READ_BUFFER as u32,
                    &mut 0,
                    self.operation.get(),
                )
            };
            if issued == 0 {
                let error = io::Error::last_os_error();
                if error.raw_os_error() == Some(ERROR_IO_PENDING as i32) {
                    self.pending = true;
                } else {
                    self.result(Err(error), false);
                }
            } else {
                self.finish_read(false);
            }
        }

        fn stop(&mut self) {
            if self.pending {
                self.finish_read(true);
            }
            self.close(None);
        }

        fn publish(&mut self, tx: &mpsc::Sender<OutputLine>) -> bool {
            while let Some(record) = self.outbox.pop_front() {
                match tx.try_send(record) {
                    Ok(()) => (),
                    Err(mpsc::error::TrySendError::Full(record)) => {
                        self.outbox.push_front(record);
                        break;
                    }
                    Err(mpsc::error::TrySendError::Closed(_)) => return false,
                }
            }
            true
        }
    }

    impl Drop for ReadStream {
        fn drop(&mut self) {
            // Unwinding or a closed consumer must also retire any kernel pointers.
            if let Some(handle) = self.handle.take() {
                if self.pending {
                    let _ = finish_overlapped(handle.as_raw_handle(), self.operation.get(), true);
                }
                unsafe {
                    DisconnectNamedPipe(handle.as_raw_handle());
                }
            }
        }
    }

    fn signaled(handle: HANDLE) -> io::Result<bool> {
        match unsafe { WaitForSingleObject(handle, 0) } {
            WAIT_OBJECT_0 => Ok(true),
            WAIT_TIMEOUT => Ok(false),
            _ => Err(io::Error::last_os_error()),
        }
    }

    fn pump(
        streams: &mut [ReadStream; 2],
        tx: &mpsc::Sender<OutputLine>,
        stop: HANDLE,
        space: HANDLE,
    ) -> io::Result<()> {
        let mut first = 0;
        loop {
            if signaled(stop)? {
                return Ok(());
            }
            first ^= 1;
            let mut again = false;
            let mut handles = [stop; 4];
            let mut len = 1;
            let mut needs_space = false;
            for index in [first, first ^ 1] {
                let stream = &mut streams[index];
                if stream.pending && signaled(stream.event.as_raw_handle())? {
                    stream.finish_read(false);
                }
                if !stream.publish(tx) {
                    return Ok(());
                }
                if stream.handle.is_some() && !stream.pending && stream.outbox.is_empty() {
                    stream.submit();
                    again |= !stream.pending;
                }
                if stream.pending {
                    handles[len] = stream.event.as_raw_handle();
                    len += 1;
                }
                needs_space |= !stream.outbox.is_empty();
            }
            if again {
                continue;
            }
            if needs_space {
                handles[len] = space;
                len += 1;
            }
            if len == 1 {
                return Ok(());
            }
            if unsafe { WaitForMultipleObjects(len as u32, handles.as_ptr(), 0, INFINITE) }
                == WAIT_FAILED
            {
                return Err(io::Error::last_os_error());
            }
        }
    }

    pub struct ReadThread {
        stop: Arc<OwnedHandle>,
        space: Arc<OwnedHandle>,
        pub(super) done: watch::Receiver<()>,
    }

    impl ReadThread {
        pub fn start(
            stdout: OwnedHandle,
            stderr: OwnedHandle,
            tx: mpsc::Sender<OutputLine>,
            drain: Drain,
        ) -> io::Result<Self> {
            let stop = Arc::new(event(true)?);
            let space = Arc::new(event(false)?);
            let (thread_stop, thread_space) = (stop.clone(), space.clone());
            let (finished, done) = watch::channel(());
            let events = [event(true)?, event(true)?];
            std::thread::Builder::new()
                .name("pipe-read".into())
                .spawn(move || {
                    let [out_event, err_event] = events;
                    let mut streams = [
                        ReadStream::new("stdout", stdout, out_event, drain),
                        ReadStream::new("stderr", stderr, err_event, drain),
                    ];
                    let result = pump(
                        &mut streams,
                        &tx,
                        thread_stop.as_raw_handle(),
                        thread_space.as_raw_handle(),
                    );
                    for stream in &mut streams {
                        stream.stop();
                    }
                    if let Err(e) = result {
                        streams[1].outbox.push_back(("stderr", Err(e.to_string())));
                    }
                    'flush: for stream in &mut streams {
                        for record in stream.outbox.drain(..) {
                            if tx.blocking_send(record).is_err() {
                                break 'flush;
                            }
                        }
                    }
                    drop(streams);
                    drop(tx);
                    drop(finished);
                })?;
            Ok(Self { stop, space, done })
        }
        pub fn stop(&self) {
            unsafe {
                SetEvent(self.stop.as_raw_handle());
            }
        }
        pub fn space_available(&self) {
            unsafe {
                SetEvent(self.space.as_raw_handle());
            }
        }
        pub async fn finish(&mut self) {
            let _ = self.done.changed().await;
        }
    }

    impl Drop for ReadThread {
        fn drop(&mut self) {
            self.stop();
        }
    }
    #[cfg(test)]
    #[tokio::test]
    async fn pending_write_reports_os_result_after_exit_or_disconnect() {
        use tokio::time::timeout;
        enum Wake {
            Completed,
            Disconnected,
            Exited,
            Abandoned,
        }
        for wake in [
            Wake::Completed,
            Wake::Disconnected,
            Wake::Exited,
            Wake::Abandoned,
        ] {
            let (server, mut reader) = tokio::task::spawn_blocking(|| pair(false))
                .await
                .unwrap()
                .unwrap();
            let mut capacity = 0;
            checked(unsafe {
                windows_sys::Win32::System::Pipes::GetNamedPipeInfo(
                    reader.as_raw_handle(),
                    null_mut(),
                    &mut capacity,
                    null_mut(),
                    null_mut(),
                )
            })
            .unwrap();
            assert!(capacity > 0);
            let writer = Arc::new(AsyncMutex::new(server));
            let (exited, signal_exit) = exit_signal().unwrap();
            let submitted = async {
                loop {
                    let mut available = 0;
                    checked(unsafe {
                        windows_sys::Win32::System::Pipes::PeekNamedPipe(
                            reader.as_raw_handle(),
                            null_mut(),
                            0,
                            null_mut(),
                            &mut available,
                            null_mut(),
                        )
                    })
                    .unwrap();
                    if available >= capacity {
                        break;
                    }
                    tokio::time::sleep(Duration::from_millis(1)).await;
                }
            };
            let mut write = Box::pin(
                ProcessInput {
                    pipe: writer.clone(),
                    exited,
                }
                .write(vec![1; capacity as usize + 1]),
            );
            tokio::select! {
                result = &mut write => panic!("full pipe write completed before wake: {result:?}"),
                result = timeout(Duration::from_secs(5), submitted) => result.unwrap(),
            }
            match wake {
                Wake::Completed => {
                    // Confirm that the OS accepted the final byte, then signal child exit
                    // before the caller polls the pending write again.
                    timeout(
                        Duration::from_secs(5),
                        tokio::task::spawn_blocking(move || {
                            use std::io::Read;
                            let mut data = vec![0; capacity as usize + 1];
                            reader.read_exact(&mut data).unwrap();
                            assert_eq!(data.last(), Some(&1));
                        }),
                    )
                    .await
                    .unwrap()
                    .unwrap();
                    signal_exit();
                    timeout(Duration::from_secs(5), write)
                        .await
                        .unwrap()
                        .unwrap();
                }
                Wake::Disconnected => {
                    drop(reader);
                    assert!(timeout(Duration::from_secs(5), write)
                        .await
                        .unwrap()
                        .is_err());
                }
                Wake::Exited => {
                    signal_exit();
                    let err = timeout(Duration::from_secs(5), write)
                        .await
                        .unwrap()
                        .unwrap_err();
                    assert_eq!(err.kind(), io::ErrorKind::BrokenPipe);
                    drop(reader);
                }
                Wake::Abandoned => {
                    drop(write);
                    // The blocking writer holds this lock until the OS completes cancellation.
                    // The full pipe still has a live reader, so the last byte cannot succeed.
                    drop(
                        timeout(Duration::from_secs(5), writer.lock())
                            .await
                            .unwrap(),
                    );
                    drop(reader);
                }
            }
        }
    }
}

#[derive(Clone)]
struct ProcessInput {
    pipe: Arc<AsyncMutex<pipes::Writer>>,
    exited: pipes::Exit,
}

impl ProcessInput {
    async fn write(self, bytes: Vec<u8>) -> io::Result<()> {
        let pipe = self.pipe.lock_owned().await;
        pipes::write_all(pipe, bytes, self.exited).await
    }
}

type Status = Result<ExitStatus, String>;
type OutputLine = (&'static str, Result<Vec<u8>, String>);
const PIPE_DRAIN: Duration = Duration::from_millis(200);

enum Record {
    Line(&'static str, Result<Vec<u8>, String>),
    Exit(Status),
}

#[derive(Clone, Copy)]
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

enum Readers {
    #[cfg(any(unix, test))]
    Async {
        stop: Option<watch::Sender<()>>,
        tasks: JoinSet<()>,
    },
    #[cfg(windows)]
    Native(pipes::ReadThread),
}

impl Readers {
    fn stop(&mut self) {
        match self {
            #[cfg(any(unix, test))]
            Self::Async { stop, .. } => drop(stop.take()),
            #[cfg(windows)]
            Self::Native(thread) => thread.stop(),
        }
    }

    async fn receive(&self, lines: &mut mpsc::Receiver<OutputLine>) -> Option<OutputLine> {
        let line = lines.recv().await?;
        #[cfg(windows)]
        match self {
            Self::Native(thread) => thread.space_available(),
            #[cfg(test)]
            Self::Async { .. } => (),
        }
        Some(line)
    }

    async fn finish(&mut self) {
        match self {
            #[cfg(any(unix, test))]
            Self::Async { tasks, .. } => while tasks.join_next().await.is_some() {},
            #[cfg(windows)]
            Self::Native(thread) => thread.finish().await,
        }
    }
}

struct ProcessOutput {
    // Dropping the reader control signals stop before the receiver releases any blocked send.
    readers: Readers,
    lines: mpsc::Receiver<OutputLine>,
    state: Lifecycle,
    drain: Drain,
}

// Darwin lacks atomic pipe2(O_CLOEXEC). Kaede-owned spawns synchronize with pipe creation;
// external tauri-plugin-shellx commands are outside this crate.
#[cfg(all(unix, not(target_os = "linux")))]
pub(crate) fn lock_unix_spawn() -> std::sync::MutexGuard<'static, ()> {
    static SPAWN: Mutex<()> = Mutex::new(());
    SPAWN.lock().unwrap_or_else(|e| e.into_inner())
}

async fn start_process(
    mut command: StdCommand,
    drain: Drain,
) -> Result<(LaunchGuard, ProcessInput, ProcessOutput), String> {
    tokio::task::spawn_blocking(move || -> io::Result<_> {
        #[cfg(all(unix, not(target_os = "linux")))]
        let launch_lock = lock_unix_spawn();
        let (stdin, input) = pipes::input()?;
        let (stdout, out) = pipes::output()?;
        let (stderr, err) = pipes::output()?;
        let (exited, signal_exit) = pipes::exit_signal()?;
        let child = Arc::new(SharedChild::spawn(
            command.stdin(input).stdout(out).stderr(err),
        )?);
        #[cfg(all(unix, not(target_os = "linux")))]
        drop(launch_lock);
        let (done, exit) = oneshot::channel();
        let waiter = child.clone();
        if let Err(error) = std::thread::Builder::new()
            .name("child-wait".into())
            .spawn(move || {
                let status = waiter.wait();
                signal_exit();
                let _ = done.send(status);
            })
        {
            child.kill()?;
            child.wait()?;
            return Err(error);
        }

        let (tx, lines) = mpsc::channel(32);
        let launch = LaunchGuard(Some(child));
        #[cfg(windows)]
        let readers = Readers::Native(pipes::ReadThread::start(stdout, stderr, tx, drain)?);
        #[cfg(unix)]
        let readers = {
            let (stop, stopping) = watch::channel(());
            let mut readers = JoinSet::new();
            readers.spawn(read_records(
                stdout,
                tx.clone(),
                "stdout",
                drain,
                stopping.clone(),
            ));
            readers.spawn(read_records(stderr, tx, "stderr", drain, stopping));
            Readers::Async {
                stop: Some(stop),
                tasks: readers,
            }
        };
        Ok((
            launch,
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

// The blocking task can finish after its awaiting command was cancelled.
// Its waiter reaps the child, including when Tokio discards the task result.
struct LaunchGuard(Option<Arc<SharedChild>>);

impl LaunchGuard {
    fn transfer(mut self) -> Arc<SharedChild> {
        self.0.take().unwrap()
    }
}

impl Drop for LaunchGuard {
    fn drop(&mut self) {
        if let Some(child) = &self.0 {
            let _ = child.kill();
        }
    }
}

impl ProcessOutput {
    async fn next(&mut self) -> Record {
        loop {
            match &mut self.state {
                Lifecycle::Running(exit) => {
                    let status = tokio::select! {
                        biased;
                        status = &mut *exit => status,
                        line = self.readers.receive(&mut self.lines) => match line {
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
                            line = self.readers.receive(&mut self.lines) => line,
                        },
                        None => self.readers.receive(&mut self.lines).await,
                    };
                    if let Some((stream, line)) = line {
                        return Record::Line(stream, line);
                    }
                    self.readers.stop();
                    self.state = Lifecycle::Finished(status.clone());
                }
                Lifecycle::Finished(status) => {
                    if let Some((stream, line)) = self.readers.receive(&mut self.lines).await {
                        return Record::Line(stream, line);
                    }
                    self.readers.finish().await;
                    return Record::Exit(status.clone());
                }
            }
        }
    }
}

const READ_BUFFER: usize = 8 * 1024;

struct LineParser {
    bytes: Vec<u8>,
    trailing_cr: bool,
    drain: Drain,
}

impl LineParser {
    fn new(drain: Drain) -> Self {
        Self {
            bytes: Vec::new(),
            trailing_cr: false,
            drain,
        }
    }

    fn next(&mut self, chunk: &mut &[u8]) -> Option<Vec<u8>> {
        if chunk.is_empty() {
            return None;
        }
        if std::mem::take(&mut self.trailing_cr) {
            if let Some(rest) = chunk.strip_prefix(b"\n") {
                *chunk = rest;
                if matches!(self.drain, Drain::Collect) {
                    self.bytes.push(b'\n');
                }
            }
            if matches!(self.drain, Drain::Collect) {
                return Some(std::mem::take(&mut self.bytes));
            }
        }
        let Some(end) = chunk.iter().position(|b| matches!(b, b'\r' | b'\n')) else {
            self.bytes.extend_from_slice(chunk);
            *chunk = &[];
            return None;
        };
        let cr = chunk[end] == b'\r';
        let mut len = end + 1;
        self.trailing_cr = cr && len == chunk.len();
        if cr && chunk.get(len) == Some(&b'\n') {
            len += 1;
        }
        self.bytes.extend_from_slice(&chunk[..len]);
        *chunk = &chunk[len..];
        if self.trailing_cr && matches!(self.drain, Drain::Collect) {
            None
        } else {
            Some(std::mem::take(&mut self.bytes))
        }
    }

    fn finish(&mut self, read_failed: bool) -> Option<Vec<u8>> {
        if self.bytes.is_empty() || (read_failed && !self.trailing_cr) {
            None
        } else {
            Some(std::mem::take(&mut self.bytes))
        }
    }
}

#[cfg(any(unix, test))]
async fn send_record<R>(
    pipe: &mut Option<R>,
    stop: &mut watch::Receiver<()>,
    tx: &mpsc::Sender<OutputLine>,
    record: OutputLine,
) -> bool {
    let permit = if pipe.is_some() {
        tokio::select! {
            biased;
            _ = stop.changed() => {
                drop(pipe.take());
                tx.reserve().await
            }
            permit = tx.reserve() => permit,
        }
    } else {
        tx.reserve().await
    };
    let Ok(permit) = permit else { return false };
    permit.send(record);
    true
}

#[cfg(any(unix, test))]
async fn read_records(
    pipe: impl tokio::io::AsyncRead + Unpin,
    tx: mpsc::Sender<OutputLine>,
    stream: &'static str,
    drain: Drain,
    mut stop: watch::Receiver<()>,
) {
    use tokio::io::AsyncReadExt;
    let mut pipe = Some(pipe);
    let mut buf = vec![0; READ_BUFFER];
    let mut parser = LineParser::new(drain);
    while let Some(reader) = pipe.as_mut() {
        if stop.has_changed().unwrap_or(true) {
            break;
        }
        let read = tokio::select! {
            biased;
            _ = stop.changed() => break,
            read = reader.read(&mut buf) => read,
        };
        let n = match read {
            Ok(0) => break,
            Ok(n) => n,
            Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
            Err(e) => {
                drop(pipe);
                if let Some(bytes) = parser.finish(true) {
                    let _ = tx.send((stream, Ok(bytes))).await;
                }
                let _ = tx.send((stream, Err(e.to_string()))).await;
                return;
            }
        };
        let mut chunk = &buf[..n];
        while let Some(record) = parser.next(&mut chunk) {
            if !send_record(&mut pipe, &mut stop, &tx, (stream, Ok(record))).await {
                return;
            }
        }
    }
    drop(pipe);
    if let Some(bytes) = parser.finish(false) {
        let _ = tx.send((stream, Ok(bytes))).await;
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
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
        time::timeout,
    };

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
                let mut request = [0];
                control.read_exact(&mut request).unwrap();
                if request == *b"p" {
                    io::stdout().write_all(b"\nready\n").unwrap();
                    eprintln!("ready");
                    io::stdin().read_exact(&mut request).unwrap();
                    control.write_all(&request).unwrap();
                    control.read_exact(&mut request).unwrap();
                    assert_eq!(&request, b"f");
                    io::stdout().write_all(&b"queued\n".repeat(96)).unwrap();
                    io::stdout().flush().unwrap();
                    control.read_exact(&mut request).unwrap();
                    assert_eq!(&request, b"e");
                }
                io::stderr()
                    .write_all(b"final stderr\nfatal error")
                    .unwrap();
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
                    if request == *b"i" || request == *b"m" {
                        let mut byte = [0];
                        io::stdin().read_exact(&mut byte).unwrap();
                        control.write_all(&byte).unwrap();
                        if request == *b"i" {
                            let _ = control.read(&mut request);
                            std::process::exit(0);
                        }
                    }
                    loop {
                        let probe: &[u8] = if request == *b"r" { b"\n" } else { b"probe\n" };
                        let out = io::stdout().write_all(probe);
                        let err = io::stderr().write_all(probe);
                        control
                            .write_all(&[out.is_err() as u8, err.is_err() as u8])
                            .unwrap();
                        if control.read_exact(&mut request).is_err() {
                            break;
                        }
                    }
                }
            }
            "abandoned" => {
                let mut control =
                    TcpStream::connect(std::env::var("KAEDE_TEST_CONTROL").unwrap()).unwrap();
                control
                    .set_read_timeout(Some(Duration::from_secs(20)))
                    .unwrap();
                println!("{}", std::process::id());
                control
                    .write_all(&std::process::id().to_le_bytes())
                    .unwrap();
                let _ = control.read(&mut [0]);
            }
            "boundary" => {
                let len = std::env::var("KAEDE_TEST_PREFIX").unwrap().parse().unwrap();
                let mut payload = vec![b'x'; len];
                payload.extend_from_slice(b"\r\n");
                io::stderr().write_all(&payload).unwrap();
            }
            "records" => io::stderr().write_all(b"a\rb\r\nc\xff\nend\rtail").unwrap(),
            mode => panic!("unexpected fixture {mode}"),
        }
        std::process::exit(0);
    }

    #[cfg(windows)]
    #[test]
    fn native_read_thread_leaves_blocking_pool_available_and_exits_on_cutoff_or_drop() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .max_blocking_threads(1)
            .build()
            .unwrap();
        runtime.block_on(async {
            for drain in [Drain::Managed, Drain::Collect] {
                timeout(Duration::from_secs(10), exercise_native_reader(drain))
                    .await
                    .unwrap();
            }
        });
    }

    #[cfg(windows)]
    async fn exercise_native_reader(drain: Drain) {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let mut cmd = fixture("child");
        cmd.env(
            "KAEDE_TEST_CONTROL",
            listener.local_addr().unwrap().to_string(),
        );
        let (launch, stdin, mut output) = start_process(cmd, drain).await.unwrap();
        let Readers::Native(thread) = &output.readers else {
            panic!("expected native reader")
        };
        let mut finished = thread.done.clone();
        let (mut direct, _) = listener.accept().await.unwrap();
        let (mut grandchild, _) = listener.accept().await.unwrap();
        direct.write_all(b"p").await.unwrap();
        let (mut stdout, mut stderr) = (false, false);
        while !(stdout && stderr) {
            match output.next().await {
                Record::Line("stdout", Ok(bytes)) if bytes == b"ready\n" => stdout = true,
                Record::Line("stderr", Ok(bytes)) if bytes == b"ready\n" => stderr = true,
                Record::Line(_, Ok(_)) => (),
                _ => panic!("fixture terminated before reader startup"),
            }
        }
        // Both streams remain open and silent while stdin needs the sole blocking worker.
        stdin.clone().write(vec![42]).await.unwrap();
        assert_eq!(direct.read_u8().await.unwrap(), 42);
        direct.write_all(b"f").await.unwrap();
        while output.lines.len() < output.lines.max_capacity() {
            tokio::time::sleep(Duration::from_millis(1)).await;
        }
        direct.write_all(b"e").await.unwrap();
        assert_eq!(direct.read(&mut [0]).await.unwrap(), 0);

        match drain {
            Drain::Managed => {
                let Lifecycle::Running(exit) = &output.state else {
                    unreachable!()
                };
                while exit.is_empty() {
                    tokio::time::sleep(Duration::from_millis(1)).await;
                }
                // Poll once to start the real drain timer, then let the queue fill again.
                assert!(
                    matches!(output.next().await, Record::Line("stdout", Ok(b)) if b == b"queued\n")
                );
                let Lifecycle::Draining {
                    deadline: Some(deadline),
                    ..
                } = output.state
                else {
                    unreachable!()
                };
                while output.lines.len() < output.lines.max_capacity() {
                    tokio::time::sleep(Duration::from_millis(1)).await;
                }
                tokio::time::sleep_until(deadline).await;
                assert!(
                    matches!(output.next().await, Record::Line("stdout", Ok(b)) if b == b"queued\n")
                );

                // The reader must disconnect before it can publish the rest of its outbox.
                loop {
                    grandchild.write_all(b"r").await.unwrap();
                    let mut errors = [0; 2];
                    grandchild.read_exact(&mut errors).await.unwrap();
                    if errors == [1, 1] {
                        break;
                    }
                    tokio::time::sleep(Duration::from_millis(1)).await;
                }

                let mut diagnostic = false;
                let mut queued = 2;
                loop {
                    match output.next().await {
                        Record::Line("stderr", Ok(bytes)) if into_line(&bytes) == "fatal error" => {
                            diagnostic = true
                        }
                        Record::Line("stdout", Ok(bytes)) if bytes == b"queued\n" => queued += 1,
                        Record::Line(_, Ok(_)) => (),
                        Record::Exit(Ok(status)) => {
                            assert_eq!(status.code(), Some(7));
                            break;
                        }
                        _ => panic!("unexpected process error"),
                    }
                }
                assert!(diagnostic);
                assert_eq!(queued, 96);
            }
            Drain::Collect => {
                let mut collecting = Box::pin(collect_child((launch, stdin, output)));
                tokio::select! {
                    biased;
                    _ = &mut collecting => panic!("inherited pipes unexpectedly reached EOF"),
                    _ = std::future::ready(()) => (),
                }
                drop(collecting);
            }
        }
        finished.changed().await.unwrap_err();
        grandchild.write_all(&[1]).await.unwrap();
        let mut errors = [0; 2];
        grandchild.read_exact(&mut errors).await.unwrap();
        assert_eq!(errors, [1, 1]);
        grandchild.shutdown().await.unwrap();
        assert_eq!(grandchild.read(&mut [0]).await.unwrap(), 0);
    }

    #[tokio::test]
    async fn managed_exit_closes_both_inherited_pipes() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let mut cmd = fixture("child");
        cmd.env(
            "KAEDE_TEST_CONTROL",
            listener.local_addr().unwrap().to_string(),
        );
        let (launch, stdin, output) = start_process(cmd, Drain::Managed).await.unwrap();
        stdin.clone().write(vec![42]).await.unwrap();
        let writer = Arc::downgrade(&stdin.pipe);
        let child = launch.transfer();
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
            let mut diagnostics = Vec::new();
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
                            diagnostics.extend(batch.lines)
                        }
                        ManagedEvent::Output(_) => (),
                        ManagedEvent::Error(e) => panic!("{}", e.message),
                        ManagedEvent::Exit(exit) => {
                            assert_eq!(diagnostics, ["final stderr", "fatal error"]);
                            assert_eq!(exit.code, Some(7));
                            assert!(registry.0.lock().unwrap().is_empty());
                            exited = true;
                        }
                    }
                },
            )
            .await;
            assert!(exited);
            assert!(writer.upgrade().is_none());
            control.write_all(b"m").await.unwrap();
            assert_eq!(control.read_u8().await.unwrap(), 42);
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
        assert_eq!(result.stderr, "a\r\nb\r\n\nc�\n\nend\r\ntail\n");
    }

    #[tokio::test]
    async fn mixed_delimiters_are_independent_of_refill_boundaries() {
        let input = b"a\rb\r\n";
        for split in 0..=input.len() {
            for drain in [Drain::Managed, Drain::Collect] {
                let reader = AsyncReadExt::chain(&input[..split], &input[split..]);
                let (tx, mut records) = mpsc::channel(8);
                let (_stop, stopping) = watch::channel(());
                read_records(reader, tx, "stdout", drain, stopping).await;
                let mut lines = Vec::new();
                let mut collected = Vec::new();
                while let Some((_, record)) = records.recv().await {
                    let record = record.unwrap();
                    lines.push(into_line(&record));
                    collected.extend(record);
                    collected.push(b'\n');
                }
                assert_eq!(lines, ["a", "b"], "split at {split}");
                if matches!(drain, Drain::Collect) {
                    assert_eq!(collected, b"a\r\nb\r\n\n", "split at {split}");
                }
            }
        }
    }

    #[tokio::test]
    async fn crlf_at_mio_refill_boundary_is_one_record() {
        for len in [4095, READ_BUFFER - 1] {
            let boundary = || {
                let mut cmd = fixture("boundary");
                cmd.env("KAEDE_TEST_PREFIX", len.to_string());
                cmd
            };
            let expected = "x".repeat(len);
            let collected = collect_output(boundary()).await.unwrap();
            assert_eq!(collected.stderr, format!("{expected}\r\n\n"));
            let (child, _stdin, output) = start_process(boundary(), Drain::Managed).await.unwrap();
            let mut lines = Vec::new();
            monitor(
                output,
                &ProcessRegistry::default(),
                child.transfer().id(),
                "test".into(),
                "test".into(),
                |event| match event {
                    ManagedEvent::Output(batch) if batch.stream == "stderr" => {
                        lines.extend(batch.lines)
                    }
                    ManagedEvent::Error(e) => panic!("{}", e.message),
                    _ => (),
                },
            )
            .await;
            assert_eq!(lines, [expected]);
        }
    }

    #[test]
    fn abandoning_launch_terminates_and_reaps_child() {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .max_blocking_threads(1)
            .build()
            .unwrap()
            .block_on(async {
                let (cmd, listener) = abandoned_fixture().await;
                // Queue creation behind a gate so its first poll cannot transfer ownership.
                let (release, gate) = oneshot::channel::<()>();
                let blocker = tokio::task::spawn_blocking(move || gate.blocking_recv());
                let mut launch = Box::pin(start_process(cmd, Drain::Managed));
                tokio::select! {
                    biased;
                    _ = &mut launch => panic!("launch returned before spawn was released"),
                    _ = std::future::ready(()) => (),
                }
                release.send(()).unwrap();
                blocker.await.unwrap().unwrap();
                // The PID handshake proves spawn ran. The launch future has not been repolled.
                assert_child_reaped(listener, || drop(launch)).await;
            });
    }

    #[tokio::test]
    async fn aborting_collection_terminates_and_reaps_child() {
        let (cmd, listener) = abandoned_fixture().await;
        let started = start_process(cmd, Drain::Collect).await.unwrap();
        let mut collecting = Box::pin(collect_child(started));
        // Poll the real collector through ownership transfer and into its read loop.
        tokio::select! {
            biased;
            _ = &mut collecting => panic!("fixture exited before cancellation"),
            _ = std::future::ready(()) => (),
        }
        let collect = tokio::spawn(collecting);
        assert_child_reaped(listener, || collect.abort()).await;
        assert!(matches!(collect.await, Err(e) if e.is_cancelled()));
    }

    async fn abandoned_fixture() -> (StdCommand, TcpListener) {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let mut cmd = fixture("abandoned");
        cmd.env(
            "KAEDE_TEST_CONTROL",
            listener.local_addr().unwrap().to_string(),
        );
        (cmd, listener)
    }

    async fn assert_child_reaped(listener: TcpListener, cancel: impl FnOnce()) {
        use sysinfo::{Pid, ProcessesToUpdate, System};
        timeout(Duration::from_secs(5), async {
            let (mut control, _) = listener.accept().await.unwrap();
            let pid = Pid::from_u32(control.read_u32_le().await.unwrap());
            let pids = [pid];
            let mut system = System::new();
            system.refresh_processes(ProcessesToUpdate::Some(&pids), true);
            assert!(system.process(pid).is_some());
            cancel();
            assert_eq!(control.read(&mut [0]).await.unwrap(), 0);
            loop {
                system.refresh_processes(ProcessesToUpdate::Some(&pids), true);
                if system.process(pid).is_none() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
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
            assert_eq!(result.stderr, "final stderr\n\nfatal errorprobe\n\n");
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn kill_interrupts_backpressured_stdin() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let mut cmd = fixture("child");
        cmd.env(
            "KAEDE_TEST_CONTROL",
            listener.local_addr().unwrap().to_string(),
        );
        let (launch, stdin, output) = start_process(cmd, Drain::Managed).await.unwrap();
        let (_direct, mut grandchild) = timeout(Duration::from_secs(5), async {
            let (direct, _) = listener.accept().await.unwrap();
            let (grandchild, _) = listener.accept().await.unwrap();
            (direct, grandchild)
        })
        .await
        .unwrap();
        let mut bytes = vec![0; 8 << 20];
        bytes[0] = 73;
        let child = launch.transfer();
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
        let writer = Arc::downgrade(&stdin.pipe);
        grandchild.write_all(b"i").await.unwrap();
        let mut write = Box::pin(stdin.write(bytes));
        tokio::select! {
            biased;
            result = &mut write => panic!("write completed before kill: {result:?}"),
            result = timeout(Duration::from_secs(5), grandchild.read_u8()) => assert_eq!(result.unwrap().unwrap(), 73),
        }
        registry.kill(pid).unwrap();
        timeout(Duration::from_secs(5), async {
            assert!(write.await.is_err());
            monitor(
                output,
                &registry,
                pid,
                "current".into(),
                "test".into(),
                |_| {},
            )
            .await;
            assert!(
                writer.upgrade().is_none(),
                "stdin owner survived registry cleanup"
            );
            grandchild.shutdown().await.unwrap();
            assert_eq!(grandchild.read(&mut [0]).await.unwrap(), 0);
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn expired_drain_delivers_queued_and_reserved_records() {
        let (tx, lines) = mpsc::channel(2);
        tx.try_send(("stdout", Ok(vec![1]))).unwrap();
        let permit = tx.reserve_owned().await.unwrap();
        let (stop, mut stopping) = watch::channel(());
        let mut readers = JoinSet::new();
        readers.spawn(async move {
            stopping.changed().await.unwrap_err();
            permit.send(("stderr", Ok(vec![2])));
        });
        let mut output = ProcessOutput {
            readers: Readers::Async {
                stop: Some(stop),
                tasks: readers,
            },
            lines,
            drain: Drain::Managed,
            state: Lifecycle::Draining {
                status: Err("wait".into()),
                deadline: Some(Instant::now() - PIPE_DRAIN),
            },
        };
        assert!(matches!(output.next().await, Record::Line("stdout", Ok(v)) if v == [1]));
        assert!(matches!(output.state, Lifecycle::Finished(_)));
        assert!(matches!(output.next().await, Record::Line("stderr", Ok(v)) if v == [2]));
        assert!(matches!(output.next().await, Record::Exit(Err(_))));
    }

    #[tokio::test]
    async fn cutoff_closes_reader_while_output_queue_is_full() {
        let (reader, mut peer) = tokio::io::duplex(64);
        peer.write_all(b"first\nsecond\nthird\ntail").await.unwrap();
        let (tx, lines) = mpsc::channel(1);
        let (stop, stopping) = watch::channel(());
        let mut reading = Box::pin(read_records(reader, tx, "stderr", Drain::Managed, stopping));
        tokio::select! {
            biased;
            _ = &mut reading => panic!("reader exited before cutoff"),
            _ = std::future::ready(()) => (),
        }
        assert_eq!(lines.len(), 1);
        let mut readers = JoinSet::new();
        readers.spawn(reading);
        let mut output = ProcessOutput {
            readers: Readers::Async {
                stop: None,
                tasks: readers,
            },
            lines,
            drain: Drain::Managed,
            state: Lifecycle::Finished(Err("done".into())),
        };
        drop(stop);
        assert_eq!(
            timeout(Duration::from_secs(5), peer.read(&mut [0]))
                .await
                .unwrap()
                .unwrap(),
            0
        );
        for expected in [b"first\n".as_slice(), b"second\n", b"third\n", b"tail"] {
            assert!(
                matches!(output.next().await, Record::Line("stderr", Ok(bytes)) if bytes == expected)
            );
        }
        assert!(matches!(output.next().await, Record::Exit(_)));
    }

    #[tokio::test]
    async fn completed_cr_record_precedes_read_error() {
        struct Failed;
        impl tokio::io::AsyncRead for Failed {
            fn poll_read(
                self: std::pin::Pin<&mut Self>,
                _: &mut std::task::Context<'_>,
                _: &mut tokio::io::ReadBuf<'_>,
            ) -> std::task::Poll<io::Result<()>> {
                std::task::Poll::Ready(Err(io::Error::other("read failed")))
            }
        }
        let (tx, mut lines) = mpsc::channel(2);
        let (_stop, stopping) = watch::channel(());
        read_records(
            AsyncReadExt::chain(&b"a\r"[..], Failed),
            tx,
            "stdout",
            Drain::Collect,
            stopping,
        )
        .await;
        assert_eq!(lines.recv().await, Some(("stdout", Ok(b"a\r".to_vec()))));
        assert_eq!(
            lines.recv().await,
            Some(("stdout", Err("read failed".into())))
        );
        assert!(lines.recv().await.is_none());
    }
}
