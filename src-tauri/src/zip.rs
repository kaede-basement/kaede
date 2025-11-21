use std::path::PathBuf;
use zip_extensions::*;

#[tauri::command]
pub fn unzip_file(archive_file_path: String, target_dir_path: String) -> Result<String, String> {
    let archive_file = PathBuf::from(archive_file_path);
    let target_dir = PathBuf::from(target_dir_path);

    match zip_extract(&archive_file, &target_dir) {
        Ok(()) => Ok("Successfully extracted the provided archive".to_string()),
        Err(error) => Err(format!("Error extracting zip: {}", error)),
    }
}
