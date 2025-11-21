#[tauri::command]
pub fn get_executable_directory() -> Result<String, String> {
    match std::env::current_exe() {
        Ok(path) => {
            if let Some(parent) = path.parent() {
                Ok(parent.to_string_lossy().to_string())
            } else {
                Err("Failed to get parent directory".to_string())
            }
        }
        Err(error) => Err(format!("Error getting executable path: {}", error)),
    }
}
