use chrono::Utc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
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
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drpc::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Handle logging strategies differently based on build mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            } else {
                // Resolves to '${dataDir}/${bundleIdentifier}'
                let path = app.path().app_data_dir()?;
                let time = Utc::now().format("%Y-%m-%d_%H-%M").to_string();

                app.handle().plugin(
                    tauri_plugin_log::Builder::new()
                        // Clear any default output targets, such as 'stdout', etc.
                        .clear_targets()
                        // Make a new output target that will save logs in a file
                        .target(tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::Folder {
                                path: path,
                                // TODO: use 'latest.log' file instead,
                                // and mark existing as 'kaede-{number}.log', where the bigger this number, the newer that file
                                file_name: Some(format!("log_{time}")),
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
