use tauri::Manager;
use log::{warn, error};

mod downloads;
mod extensions;
mod file_system;
mod finalization;
mod hashing;
mod application;
mod logging;
mod modrinth;
mod processes;
mod system;
mod translations;
mod zip;

// Launcher name
const APP_NAME: &str = "kaede";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // A portable fixed-version WebView2 runtime for Windows builds
    #[cfg(windows)]
    if std::env::var_os("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER").is_none() {
        if let Some(runtime_dir) = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|dir| dir.join("WebView2")))
            .filter(|dir| dir.join("msedgewebview2.exe").is_file())
        {
            std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", &runtime_dir);
        }
    }

    let builder = tauri::Builder::default();

    // The "notifications" feature is disabled for Windows 7 builds
    #[cfg(feature = "notifications")]
    let builder = builder.plugin(tauri_plugin_notification::init());

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // If user tries to open the launcher when it is already opened,
            // then focus the already opened window
            if let Some(window) = app.get_webview_window("main") {
				warn!("An already opened Kaede process exists");
                let _ = window.set_focus();
            }
        }))
        // 'true' makes the plugin accept any shell command
        .plugin(tauri_plugin_shellx::init(true))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // Initially, checking whether the application is in a portable mode or not
            // was made by reading the window label to find a 'Portable' string, which
            // only took '225.60µs' on my laptop, not as slow as I thought.
            //
            // Nevertheless, I was enlightened by Prism Launcher
            // that uses 'portable.txt' to make the launcher portable
            let (base_directory, portable) = application::get_application_directory_info(app.handle())?;
            let path = base_directory.join("logs");

            // 'app.get_webview_window("main").is_some()' is true at this point since Tauri initializes a WebView
            // creation somewhere right before this 'setup' code. Sleeping the thread for 5 seconds makes
            // the tauri IPC hang while the WebView itself is already loaded (?)
            //
            // '09:57:54.326 | ... | Hi: true' - 'info!("Hi: {}", app.get_webview_window("main").is_some());'
            // '09:57:59.358 | ... | WebView for Kaede has loaded >.<'
            // '...'
            // '09:58:00.104 | ... | Launcher successfully initialized in: 5810.9 ms'
            //
            // Since 'get_initial_state' fetches the hash of the executable only when the frontend
            // makes a call to it, I decided that we can offload the hash calculation to a one-time
            // action that runs *while* the WebView is loading, i.e., before the frontend itself
            // can make such a call
            tauri::async_runtime::spawn(async {
                hashing::APPLICATION_HASH.get_or_init(hashing::get_executable_hash).await;
            });
            // Besides hashing, we can also read configs ahead-of-time
            app.manage(application::PreloadedState::new(base_directory, portable));

            // Creates the 'logs' directory if it doesn't exist
            std::fs::create_dir_all(&path)?;

            // Prepare the log file.
            //
            // Rewriting this from TypeScript to Rust lead to way faster code execution:
            // (Note: 906 files in the 'logs' directory)
            // - TypeScript took 80 ms on average.
            // - Rust       took  3 ms on average (holy fuck).
            //
            // Do not blame JavaScript though, because Tauri API
            // is time-wise expensive to invoke from JavaScript.
            // 90% of the time JavaScript seemed to just wait for Tauri commands resolving.
            //
            // Also:
            // The logging plugin locks the 'latest.log' file once it initializes,
            // so deleting that file while application is still working will lead to errors.
            //
            // Clearly, at this point of code Tauri logging plugin has NOT been loaded yet.
            // This means that the log file can be manipulated in any way.
            //
            // But in JavaScript, the logging plugin has already been loaded.
            // Thus, the logging preparation strategy provided below will fail,
            // requiring the JavaScript code to copy the contents from the log file into another one
            // instead of just renaming that file. Of course, copying takes more time than renaming
            if let Err(error) = application::prepare_log_file(&path, APP_NAME) {
                error!("Failed to prepare the log file: {}", error);
            }

            app.manage(logging::LogTail::new(path.join("latest.log")));
            app.handle().plugin(
                tauri_plugin_log::Builder::new()
                    // Clear any default output targets
                    .clear_targets()
                    // Do not log messages from 'reqwest::connect'
                    .filter(|metadata| metadata.target() != "reqwest::connect")
                    // Do not log 'trace' level messages
                    .level(log::LevelFilter::Debug)
                    // Make a new output target that will save logs in a log file
                    .target(tauri_plugin_log::Target::new(
                        tauri_plugin_log::TargetKind::Folder {
                            path,
                            file_name: Some("latest".to_string()),
                        },
                    ))
                    // Also log to terminal
                    .target(tauri_plugin_log::Target::new(
                        tauri_plugin_log::TargetKind::Stdout,
                    ))
                    // Make a custom logs format
                    .format(|out, message, record| {
                        let now = time::OffsetDateTime::now_utc();
                        // Default tauri logging format does not include milliseconds
                        let formatted_time = format!("{:02}:{:02}:{:02}.{:03}",
                            now.hour(), now.minute(), now.second(), now.millisecond());

                        out.finish(format_args!(
                            "{} | {} | {} | {}",
                            formatted_time,
                            record.level(),
                            record.target(),
                            message,
                        ))
                    })
                    // Keep the log file size at 8 MiB
                    .max_file_size(8_388_608)
                    // Keep the recent log lines if the file size exceeds 8 MiB
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                    .build(),
            )?;

            Ok(())
        })
        .manage(processes::ProcessRegistry::default())
        .manage(downloads::CancelFlags::default())
        // Register custom Tauri commands
        .invoke_handler(tauri::generate_handler![
            application::get_initial_state,
            downloads::concurrently_download,
            downloads::cancel_downloads,
            extensions::read_extensions,
            file_system::verify_paths,
            file_system::verify_paths_hash,
            finalization::finalize_initialization,
            // TODO move to java::get_java_major and java::detect_java_installations
            finalization::get_java_major,
            finalization::detect_java_installations,
            hashing::hash_path,
            hashing::hash_request_sha256,
            hashing::hash_request_sha1,
            hashing::hash_request_md5,
            logging::stream_logs,
            logging::stop_log_stream,
            modrinth::install_mrpack,
            modrinth::peek_mrpack,
            processes::list_processes,
            processes::spawn_process,
            processes::kill_process,
            processes::write_process,
            processes::run_process,
            system::get_system_memory,
            system::get_cpu_usage,
            translations::get_locales,
            zip::read_archive_entry,
            zip::unzip_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
