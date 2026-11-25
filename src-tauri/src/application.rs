use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Mutex;
use serde::Serialize;
use tauri::Manager;

use crate::file_system::{load_config_files, ParsedFile};
use crate::hashing::{self, APPLICATION_HASH};

static LAUNCH_COUNT: AtomicI32 = AtomicI32::new(0);

pub fn is_portable() -> bool {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.join("portable.txt").exists();
        }
    }
    false
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialStateBasic {
    pub launcher_version: String,
    pub base_directory: String,
    pub launch_count: i32,
    pub separator: String,
    pub portable: bool,
}

pub fn get_application_directory_info(app: &tauri::AppHandle) -> Result<(PathBuf, bool), String> {
    let portable = is_portable();
    let base_directory = if portable {
        std::env::current_exe()
            .map_err(|error| error.to_string())?
            .parent()
            .ok_or_else(|| "Failed to get executable directory".to_string())?
            .to_path_buf()
    } else {
        app.path().app_data_dir().map_err(|error| error.to_string())?
    };

    Ok((base_directory, portable))
}

fn get_basic_state(launcher_version: String, base_directory: &Path, portable: bool) -> InitialStateBasic {
    InitialStateBasic {
        launcher_version,
        base_directory  : base_directory.to_string_lossy().to_string(),
        launch_count    : LAUNCH_COUNT.fetch_add(1, Ordering::SeqCst),
        separator       : std::path::MAIN_SEPARATOR.to_string(),
        portable,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialStateParsedFiles {
    pub config: ParsedFile,
    pub accounts: ParsedFile,
    pub instances: ParsedFile,
    pub translations: ParsedFile,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialShellState {
    pub basic: InitialStateBasic,
    pub parsed: InitialStateParsedFiles,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialState {
    #[serde(flatten)]
    pub shell: InitialShellState,
    pub executable_hash: String,
}

pub struct PreloadedState {
    portable       : bool,
    base_directory : PathBuf,
    // Suppose a multi-window plugin (it was the first plugin I ever made for Kaede, I think)
    // is installed. It works by simply creating several windows that have the same frontend code
    // with just different pages open. In such case, 'get_initial_state' can be called several times
    // in the same time window, but 'JoinHandle' can be awaited only once. Hence, we use 'Option<T>'
    // to later use 'take()' in the first call so the other calls get 'None'
    initial_configs: Mutex<Option<
        // If the frontend calls faster than the configs get parsed, the task can be awaited
        tauri::async_runtime::JoinHandle<
            // 'load_config_files'
            Result<InitialStateParsedFiles, String>
        >
    >>,
}

impl PreloadedState {
    pub fn new(base_directory: PathBuf, portable: bool) -> Self {
        let handle = tauri::async_runtime::spawn(load_config_files(base_directory.clone()));
        Self { portable, base_directory, initial_configs: Mutex::new(Some(handle)) }
    }
}

#[tauri::command]
pub async fn get_initial_shell_state(
    app: tauri::AppHandle,
    preloaded_state: tauri::State<'_, PreloadedState>,
) -> Result<InitialShellState, String> {
    load_shell_state(app.package_info().version.to_string(), &preloaded_state).await
}

async fn load_shell_state(
    launcher_version: String,
    preloaded_state: &PreloadedState,
) -> Result<InitialShellState, String> {
    let handle = preloaded_state.initial_configs.lock().unwrap().take();
    let parsed_configs = match handle {
        Some(actual_handle) => match actual_handle.await {
            Ok(result) => result?,
            Err(_)     => load_config_files(preloaded_state.base_directory.clone()).await?,
        },
        None => load_config_files(preloaded_state.base_directory.clone()).await?,
    };

    let basic_state = get_basic_state(
        launcher_version,
        &preloaded_state.base_directory,
        preloaded_state.portable,
    );

    Ok(InitialShellState {
        basic: basic_state,
        parsed: parsed_configs,
    })
}

#[tauri::command]
pub async fn get_executable_hash() -> Result<String, String> {
    APPLICATION_HASH.get_or_try_init(|| async {
        let digest = hashing::get_executable_hash().await;
        if digest.len() == 64 {
            Ok(digest)
        } else {
            Err(digest)
        }
    }).await.cloned()
}

#[tauri::command]
pub async fn get_initial_state(
    app: tauri::AppHandle,
    preloaded_state: tauri::State<'_, PreloadedState>,
) -> Result<InitialState, String> {
    let shell = get_initial_shell_state(app, preloaded_state).await?;
    // Preserve the legacy command's error sentinel while allowing another window to retry.
    let executable_hash = get_executable_hash().await.unwrap_or_else(|sentinel| sentinel);
    Ok(InitialState { shell, executable_hash })
}

// If the 'latest.log' file exists and is not empty,
// then rename that file to 'kaede-{number}.log',
// where 'number' is one greater than the biggest existing log file number.
//
// Else abort the log file preparation.
pub fn prepare_log_file(logs_dir: &Path, app_name: &str) -> std::io::Result<()> {
    let latest_log_path = logs_dir.join("latest.log");

    if !latest_log_path.exists() {
        return Ok(());
    }

    let metadata = fs::metadata(&latest_log_path)?;

    // Empty log files are already prepared for logging
    if metadata.len() == 0 {
        return Ok(());
    }

    // Rotated log files are named '{app_name}-{number}.log'
    let prefix = format!("{}-", app_name);

    // We will keep track of the biggest log file number to make a unique file name
    let mut max_number: usize = 0;

    for entry in fs::read_dir(logs_dir)? {
        let entry = entry?;
        let file_name = entry.file_name();

        // Skip files whose names are not valid UTF-8
        let Some(filename) = file_name.to_str() else {
            continue;
        };

        // Count only '{prefix}{number}.log' files
        let number = filename
            .strip_prefix(&prefix)
            .and_then(|rest| rest.strip_suffix(".log"))
            .and_then(|digits| digits.parse::<usize>().ok());

        if let Some(number) = number {
            max_number = max_number.max(number);
        }
    }

    // Get the absolute path of the renamed log file
    let new_log_path = logs_dir.join(format!(
        "{}-{}.log",
        app_name,
        max_number + 1,
    ));

    // 'latest.log' becomes 'kaede-{number}.log'
    fs::rename(&latest_log_path, &new_log_path)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn shell_state_precedes_shared_digest() {
        let directory = std::env::temp_dir().join(format!("kaede-shell-test-{}", std::process::id()));
        let preloaded = PreloadedState::new(directory, true);
        let shell = load_shell_state("test".to_string(), &preloaded).await.unwrap();
        assert!(matches!(shell.parsed.config, ParsedFile::Missing));
        assert!(shell.basic.portable);
        assert!(APPLICATION_HASH.get().is_none());

        let (first, second) = tokio::join!(get_executable_hash(), get_executable_hash());
        let first = first.unwrap();
        assert_eq!(first.len(), 64);
        assert!(first.bytes().all(|byte| byte.is_ascii_hexdigit()));
        assert_eq!(second.unwrap(), first);
        assert_eq!(APPLICATION_HASH.get(), Some(&first));
        let legacy = serde_json::to_value(InitialState { shell, executable_hash: first }).unwrap();
        assert!(legacy["basic"]["portable"].as_bool().unwrap());
        assert!(legacy["parsed"]["config"].is_object());
        assert_eq!(legacy["executableHash"], APPLICATION_HASH.get().unwrap().as_str());
    }
}
