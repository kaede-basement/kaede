use std::fs;
use std::path::{Path};

// Keep track of launcher UI reloads
static mut LAUNCHES_COUNT: i32 = -1;

// Strategy:
//
// If the 'latest.log' file exists and is not empty,
// then rename that file to 'kaede-{number}.log',
// where the 'number' property is the next biggest and unique log file number.
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

    // Get the file name prefix using current application name
    let prefix = format!("{}-", app_name);
    let prefix_length = prefix.len();
    // The '.log' extension consists of 4 characters
    let log_extension_length = 4;

    // We will keep track of the biggest log file number to make a unique file name
    let mut max_number = 0;

    for entry in fs::read_dir(logs_dir)? {
        let entry = entry?;
        let path = entry.path();

        let filename = match path.file_name().and_then(|f| f.to_str()) {
            Some(name) => name,
            None => continue,
        };
        // Count the file name length without its extension
        let clean_filename_length = filename.len() - log_extension_length;

        // Prefix length should be smaller than the cleaned file name length
        if prefix_length >= clean_filename_length {
          continue;
        }

        let extracted_number = &filename[prefix_length..clean_filename_length];
        // Parse the extracted number
        let parsed_number = match extracted_number.parse::<usize>() {
            Ok(n) => n,
            Err(_) => continue,
        };

        max_number = max_number.max(parsed_number);
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

// 'get_launched_state' will be called on every JS initialization code
#[tauri::command]
pub fn get_launched_state() -> i32 {
    // unsafe is not safe (what)
    unsafe {
        LAUNCHES_COUNT = LAUNCHES_COUNT + 1;

        return LAUNCHES_COUNT;
    }
}

#[tauri::command]
pub fn get_executable_directory() -> Result<String, String> {
    match std::env::current_exe() {
        Ok(path) => {
            if let Some(parent) = path.parent() {
                Ok(parent.to_string_lossy().to_string())
            } else {
                Err("Failed to get the parent directory".to_string())
            }
        }
        Err(error) => Err(format!("Error getting the executable path: {}", error)),
    }
}
