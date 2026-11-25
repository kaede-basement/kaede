use std::path::PathBuf;
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Mutex;
use serde::Serialize;
use tauri::Manager;

use crate::file_system::{load_config_files, ParsedFile};
use crate::hashing::{APPLICATION_HASH, get_executable_hash};

static LAUNCH_COUNT: AtomicI32 = AtomicI32::new(0);

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
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent().filter(|dir| dir.join("portable.txt").exists()) {
            return Ok((dir.to_owned(), true));
        }
    }
    Ok((app.path().app_data_dir().map_err(|e| e.to_string())?, false))
}

pub fn get_basic_state(app: &tauri::AppHandle, base_directory: PathBuf, portable: bool) -> InitialStateBasic {
    InitialStateBasic {
        launcher_version: app.package_info().version.to_string(),
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
pub struct InitialState {
    pub basic: InitialStateBasic,
    pub parsed: InitialStateParsedFiles,
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
pub async fn get_initial_state(
    app: tauri::AppHandle,
    preloaded_state: tauri::State<'_, PreloadedState>,
) -> Result<InitialState, String> {
    let handle = preloaded_state.initial_configs.lock().unwrap().take();
    let parsed_configs = match handle {
        Some(actual_handle) => match actual_handle.await {
            Ok(result) => result?,
            Err(_)     => load_config_files(preloaded_state.base_directory.clone()).await?,
        },
        None => load_config_files(preloaded_state.base_directory.clone()).await?,
    };

    let executable_hash = startup_hash(APPLICATION_HASH.get_or_try_init(get_executable_hash).await);
    let basic_state = get_basic_state(
        &app,
        preloaded_state.base_directory.clone(),
        preloaded_state.portable,
    );

    Ok(InitialState {
        basic: basic_state,
        parsed: parsed_configs,
        executable_hash,
    })
}

fn startup_hash(result: Result<&String, String>) -> String {
    result.cloned().unwrap_or_else(|error| {
        log::error!("Failed to hash launcher executable: {error}");
        "no_hash".to_owned()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn unreadable_executable_leaves_cache_retryable() {
        let cache = tokio::sync::OnceCell::new();
        let failure = cache
            .get_or_try_init(|| async {
                Err(std::io::Error::from(std::io::ErrorKind::PermissionDenied).to_string())
            })
            .await;
        assert_eq!(startup_hash(failure), "no_hash");
        assert!(cache.get().is_none());

        let retry = cache.get_or_try_init(|| async { Ok("digest".into()) }).await;
        assert_eq!(startup_hash(retry), "digest");
    }
}
