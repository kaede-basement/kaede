static mut LAUNCHES_COUNT: i32 = -1;

#[tauri::command]
pub fn get_launched_state() -> i32 {
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
        Err(error) => Err(format!("Error getting executable path: {}", error)),
    }
}
