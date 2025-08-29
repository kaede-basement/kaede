use tauri::Manager;
use chrono::Utc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Handle logging strategies differently based on build mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            } else {
                //
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
                                file_name: Some(
                                    format!("log_{time}"),
                                ),
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
