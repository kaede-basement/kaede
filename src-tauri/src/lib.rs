use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // If user tries to open the launcher when it is already opened,
            // then focus the already opened window
            let _ = app
                .get_webview_window("main")
                .expect("no main window found - tauri single instance plugin")
                .set_focus();
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drpc::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Since I am a complete newbie in Rust and Tauri,
            // I couldn't think up of anything better than detecting
            // whether the launcher is in the portable mode or not
            // by checking if a window title contains a "Portable" string
            //
            // Reading window label took '225.60µs' on my laptop,
            // so no worries about performance I guess
            let window_title = app
                .get_webview_window("main")
                .expect("no main window found - tauri setup")
                .title()
                .unwrap()
                .to_string();

            let mut path;

            if window_title.contains("Portable") {
                // Resolves to the launcher executable file directory
                path = std::env::current_exe().unwrap().parent().unwrap().to_path_buf();
            } else {
                // Resolves to '${dataDir}/${bundleIdentifier}'
                path = app.path().app_data_dir()?;
            }

            path.push("logs");

            let _ = std::fs::create_dir_all(&path)?;

            // Handle logging strategies differently based on build mode
            if cfg!(debug_assertions) {
                // Debug mode
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        // Make a new output target that will save logs in a log file
                        .target(tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::Folder {
                                path: path,
                                file_name: Some(format!("latest")),
                            },
                        ))
                        // Use log rotation
                        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                        .build(),
                )?;
            } else {
                // Release mode
                app.handle().plugin(
                    tauri_plugin_log::Builder::new()
                        // Clear any default output targets, such as 'stdout', etc.
                        .clear_targets()
                        // Make a new output target that will save logs in a log file
                        .target(tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::Folder {
                                path: path,
                                file_name: Some(format!("latest")),
                            },
                        ))
                        // Keep log file size at 8 MB
                        .max_file_size(8_388_608)
                        // Use log rotation
                        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_executable_directory])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_executable_directory() -> Result<String, String> {
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