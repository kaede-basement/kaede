use tauri::Manager;
use chrono::{DateTime, Utc};
use log::error;

mod launcher;
mod system;
mod zip;

// Launcher name
const APP_NAME: &str = "kaede";

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
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Since I am a complete newbie in Rust and Tauri,
            // I couldn't think up of anything better than detecting
            // whether the launcher is in the portable mode or not
            // by checking if a window title contains a "Portable" string
            //
            // Reading window label took '225.60µs' on my laptop,
            // so no worries about the performance I guess
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

            // Create the 'logs' directory if it doesn't exist
            let _ = std::fs::create_dir_all(&path)?;

            // Prepare the log file.
            //
            // Rewriting this from TypeScript to Rust lead to way faster code execution:
            // (906 files in the directory)
            // - TypeScript took 80 ms on average;
            // - Rust       took  3 ms on average.
            //
            // Crazy results, huh?
            //
            // Do not blame JavaScript though, because time-wise,
            // Tauri API is really expensive to invoke from JavaScript.
            // That is why 80% of the time JavaScript was just being blocked by Tauri command invokes.
            //
            // Also:
            // Seems like the logging plugin locks the log file once it initializes,
            // so deleting that file while application is working will lead to errors.
            //
            // And at this exact point of code, Tauri logging plugin has NOT been loaded yet.
            // This means we can do whatever we want with the current log file.
            //
            // But in JavaScript, the logging plugin has already been loaded,
            // so instead of just renaming the file, we need to copy the contents from it,
            // and then clear the current file content. Of course,
            // this approach takes more time.
            if let Err(error) = launcher::prepare_log_file(&path, APP_NAME) {
                error!("Failed to prepare the log file: {}", error);
            }

            // Handle logging targets differently based on build mode
            let logging_builder = if cfg!(debug_assertions) {
                // Debug mode
                tauri_plugin_log::Builder::default()
            } else {
                // Release mode
                // Clear any default output targets, such as 'stdout', etc.
                tauri_plugin_log::Builder::new().clear_targets()
            };

            app.handle().plugin(
                logging_builder
                    // Make a new output target that will save logs in a log file
                    .target(tauri_plugin_log::Target::new(
                        tauri_plugin_log::TargetKind::Folder {
                            path: path,
                            file_name: Some(format!("latest")),
                        },
                    ))
                    // Make a custom logs format
                    .format(|out, message, record| {
                        let now_utc: DateTime<Utc> = Utc::now();
                        let formatted_date = now_utc.format("%d-%m-%Y").to_string();
                        // Default tauri logging format doesn't include milliseconds
                        let formatted_time = now_utc.format("%H:%M:%S%.3f").to_string();

                        out.finish(format_args!(
                            "[{}][{}][{}][{}] {}",
                            formatted_date,
                            formatted_time,
                            record.target(),
                            record.level(),
                            message,
                        ))
                    })
                    // Keep the log file size at 8 MB
                    .max_file_size(8_388_608)
                    // Use log rotation
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                    .build(),
            )?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            launcher::get_launched_state,
            launcher::get_executable_directory,
            system::get_system_memory,
            system::get_process_memory,
            zip::unzip_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
