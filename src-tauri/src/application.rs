use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI32, Ordering};

use serde::Serialize;
use serde_json::Value;
use tauri::Manager;

use crate::hashing::{APPLICATION_HASH, get_executable_hash};

static LAUNCH_COUNT: AtomicI32 = AtomicI32::new(0);

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ParsedFile {
    // For a well-formed JSON
    Loaded { data: Value },
    // The file is empty or does not exist.
    // It will be rewritten with default contents
    Missing,
    // The file exists and is not empty, but has invalid JSON.
    // It will be backed up and a new file with default contents will be created
    Corrupt { raw: String, error: String },
}

async fn load_json_file(path: PathBuf) -> Result<ParsedFile, String> {
    let content = match tokio::fs::read_to_string(&path).await {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(ParsedFile::Missing),
        Err(error) => return Err(format!("Failed to read {}: {}", path.display(), error)),
    };

    // Treat empty files as missing (so that they will be rewritten without any corrupt file backups)
    if content.trim().is_empty() {
        return Ok(ParsedFile::Missing);
    }

    match serde_json::from_str::<Value>(&content) {
        Ok(data) => Ok(ParsedFile::Loaded { data }),
        Err(error) => Ok(ParsedFile::Corrupt {
            raw: content,
            error: error.to_string(),
        }),
    }
}

fn extract_locale(config: &ParsedFile) -> String {
    let ParsedFile::Loaded { data } = config else {
        return "en".to_string();
    };

    data.get("locale")
        .and_then(Value::as_str)
        .filter(|locale| {
            !locale.is_empty()
                && locale
                    .chars()
                    // I do not want to see '../accounts'
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        })
        .unwrap_or("en")
        .to_string()
}

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
    pub executable_hash: String,
    pub base_directory: String,
    pub launch_count: i32,
    pub separator: String,
    pub portable: bool,
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
}

#[tauri::command]
pub async fn get_initial_state(app: tauri::AppHandle) -> Result<InitialState, String> {
    let portable = is_portable();
    let launcher_version = app.package_info().version.to_string();
    let launch_count = LAUNCH_COUNT.fetch_add(1, Ordering::SeqCst);
    let separator = std::path::MAIN_SEPARATOR.to_string();

    let base_directory = if portable {
        std::env::current_exe()
            .map_err(|error| error.to_string())?
            .parent()
            .ok_or_else(|| "Failed to get executable directory".to_string())?
            .to_path_buf()
    } else {
        app.path().app_data_dir().map_err(|error| error.to_string())?
    };

    let (config, accounts, instances) = tokio::join!(
        load_json_file(base_directory.join("config.json")),
        load_json_file(base_directory.join("accounts.json")),
        load_json_file(base_directory.join("instances.json")),
    );

    let config = config?;
    let accounts = accounts?;
    let instances = instances?;

    let locale = extract_locale(&config);
    let translations = load_json_file(
        base_directory.join("translations").join(format!("{}.json", locale)),
    )
    .await?;

    let executable_hash = APPLICATION_HASH.get_or_init(get_executable_hash).await;

    Ok(InitialState {
        basic: InitialStateBasic {
            executable_hash: executable_hash.clone(),
            base_directory:  base_directory.to_string_lossy().to_string(),
            launcher_version,
            launch_count,
            separator,
            portable,
        },
        parsed: InitialStateParsedFiles {
            config,
            accounts,
            instances,
            translations,
        },
    })
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
