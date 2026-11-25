use tauri::Manager;
use log::warn;

mod application;
mod downloads;
mod extensions;
mod file_system;
mod finalization;
mod hashing;
mod image;
#[cfg(any(windows, target_os = "linux"))]
mod ipc_batch;
mod ipc_dispatch;
mod logging;
mod json_file;
mod modrinth;
mod mod_store;
mod processes;
mod staging;
mod system;
mod translations;
mod zip;

type Incoming<R> = tauri::ipc::Invoke<R>;

struct Invoke<R: tauri::Runtime = tauri::Wry> {
    queue: std::sync::Arc<ipc_dispatch::Queue>,
    message: tauri::ipc::InvokeMessage<R>,
    acl: Option<Vec<tauri::utils::acl::resolved::ResolvedCommand>>,
}

fn argument<'a, T: tauri::ipc::CommandArg<'a, R>, R: tauri::Runtime>(
    invoke: &'a Invoke<R>,
    name: &'static str,
    key: &'static str,
) -> Result<T, tauri::ipc::InvokeError> {
    T::from_command(tauri::ipc::CommandItem {
        plugin: None,
        name,
        key,
        message: &invoke.message,
        acl: &invoke.acl,
    })
}

fn bind_at_dispatch<R: tauri::Runtime>(
    other: impl Fn(Incoming<R>) -> bool,
) -> impl Fn(Incoming<R>) -> bool {
    move |invoke| {
        let dispatcher = invoke
            .message
            .webview_ref()
            .state::<ipc_dispatch::Dispatcher>()
            .inner()
            .clone();
        match invoke.message.command() {
            "concurrently_download" => {
                dispatcher.dispatch(invoke, downloads::concurrently_download)
            }
            "repair_legacy_mrpack" => dispatcher.dispatch(invoke, modrinth::repair_legacy_mrpack),
            "cancel_downloads" => dispatcher.dispatch(invoke, downloads::cancel_downloads),
            "install_mrpack" => dispatcher.dispatch(invoke, modrinth::install_mrpack),
            "stream_logs" => dispatcher.dispatch(invoke, logging::stream_logs),
            "stop_log_stream" => dispatcher.dispatch(invoke, logging::stop_log_stream),
            "get_system_memory" => dispatcher.dispatch(invoke, |_| Ok(system::get_system_memory())),
            "get_cpu_usage" => dispatcher.dispatch(invoke, |_| Ok(system::get_cpu_usage())),
            "resize_image" => dispatcher.dispatch(invoke, |i| {
                Ok(image::resize_image(
                    argument(i, "resize_image", "imagePath")?,
                    argument(i, "resize_image", "toWidth")?,
                    argument(i, "resize_image", "toHeight")?,
                    argument(i, "resize_image", "toDirectory")?,
                ))
            }),
            "peek_mrpack" => dispatcher.dispatch(invoke, |i| {
                Ok(modrinth::peek_mrpack(argument(
                    i,
                    "peek_mrpack",
                    "archivePath",
                )?))
            }),
            "verify_paths" => dispatcher.dispatch(invoke, |i| {
                Ok(file_system::verify_paths(argument(
                    i,
                    "verify_paths",
                    "paths",
                )?))
            }),
            "verify_paths_hash" => dispatcher.dispatch(invoke, |i| {
                Ok(file_system::verify_paths_hash(
                    argument(i, "verify_paths_hash", "artifacts")?,
                    argument(i, "verify_paths_hash", "algorithm")?,
                ))
            }),
            "collect_stages" => dispatcher.dispatch(invoke, |i| {
                let name = "collect_stages";
                let store = argument::<tauri::State<staging::Staging>, _>(i, name, "staging")?
                    .inner().clone();
                Ok(store.collect(argument(i, name, "only")?, argument(i, name, "protected")?))
            }),
            "trim_archives" => dispatcher.dispatch(invoke, |i| {
                let tail = argument::<tauri::State<std::sync::Arc<logging::LogTail>>, _>(
                    i, "trim_archives", "tail",
                )?.inner().clone();
                Ok(async move {
                    tokio::task::spawn_blocking(move || tail.trim_archives()).await
                        .map_err(|e| e.to_string())?.map_err(|e| e.to_string())
                })
            }),
            "publish_text" => dispatcher.dispatch(invoke, |i| {
                let name = "publish_text";
                Ok(json_file::publish_text(
                    argument(i, name, "path")?, argument(i, name, "contents")?,
                    argument(i, name, "private")?, argument(i, name, "preserve")?,
                    argument(i, name, "expectedHash")?,
                ))
            }),
            "clear_mod_cache" => dispatcher.dispatch(invoke, |i| {
                let store = argument::<tauri::State<mod_store::ModStore>, _>(
                    i,
                    "clear_mod_cache",
                    "store",
                )?
                .inner()
                .clone();
                Ok(async move { store.clear().await })
            }),
            _ => other(invoke),
        }
    }
}



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

    // Tauri's default IPC sends every invoke as its own 'fetch', which is slow in WebView2.
    // 'hybrid_ipc.js' sends small calls through 'postMessage' instead, and the calls made
    // in one tick go as one message to 'ipc_batch'.
    // macOS keeps the default transport since it was not tested there
    #[cfg(any(windows, target_os = "linux"))]
    let builder = builder.invoke_system(include_str!("hybrid_ipc.js"));
    let builder = builder.on_page_load(|webview, load| {
        if load.event() == tauri::webview::PageLoadEvent::Started {
            logging::page_changed(&mut webview.window_ref().resources_table(), false);
            staging::release_page(&mut webview.resources_table());
            downloads::end_reservation_scope(&mut webview.resources_table());
            #[cfg(any(windows, target_os = "linux"))]
            ipc_batch::page_left(webview);
        }
    });
    let builder = builder.on_window_event(|window, event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            logging::page_changed(&mut window.resources_table(), true);
            downloads::end_reservation_scope(&mut window.resources_table());
            #[cfg(any(windows, target_os = "linux"))]
            ipc_batch::window_destroyed(window.label());
        }
    });

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
            app.manage(ipc_dispatch::Dispatcher::for_app(app.handle()));
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
                if let Err(error) = hashing::APPLICATION_HASH.get_or_try_init(hashing::get_executable_hash).await {
                    log::error!("Failed to preload executable hash: {error}");
                }
            });
            // Besides hashing, we can also read configs ahead-of-time
            app.manage(staging::Staging::new(&base_directory));
            app.manage(mod_store::ModStore::new(&base_directory));
            app.manage(application::PreloadedState::new(base_directory, portable));

            // Creates the 'logs' directory if it doesn't exist
            std::fs::create_dir_all(&path)?;

            let tail = std::sync::Arc::new(logging::LogTail::new(path.join("latest.log")));
            app.manage(tail.clone());
            let open = || {
                let tail = tail.clone();
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
                            path: path.clone(),
                            file_name: Some("latest".to_string()),
                        },
                    ))
                    // Also log to terminal
                    .target(tauri_plugin_log::Target::new(
                        tauri_plugin_log::TargetKind::Stdout,
                    ))
                    // Make a custom logs format
                    .format(move |out, message, record| {
                        let now = time::OffsetDateTime::now_utc();
                        // Default tauri logging format does not include milliseconds
                        let line = format!(
                            "{:02}:{:02}:{:02}.{:03} | {} | {} | {}",
                            now.hour(), now.minute(), now.second(), now.millisecond(),
                            record.level(),
                            record.target(),
                            message,
                        );
                        out.finish(format_args!("{line}"));
                        tail.record_bytes(line.len() + 1);
                    })
                    // Keep the log file size at 8 MiB
                    .max_file_size(logging::LOG_BYTES as u128)
                    // Keep the recent log lines if the file size exceeds 8 MiB
                    .file_open_strategy(tauri_plugin_log::FileOpenStrategy::Rotate)
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                    .split(app.handle())
            };
            let logger = open();
            #[cfg(windows)]
            let logger = logging::retry_locked_rotation(&path.join("latest.log"), logger, open);
            let (plugin, level, logger) = logger?;
            tauri_plugin_log::attach_logger(level, logger)?;
            app.handle().plugin(plugin)?;

            Ok(())
        })
        .manage(processes::ProcessRegistry::default())
        .manage(downloads::CancelFlags::default())
        // Register custom Tauri commands
        .invoke_handler(bind_at_dispatch(tauri::generate_handler![
            staging::pin_stage,
            application::get_initial_state,
            downloads::prepare_mrpack_install,
            extensions::read_extensions,
            finalization::finalize_initialization,
            // TODO move to java::get_java_major and java::detect_java_installations
            finalization::get_java_major,
            finalization::detect_java_installations,
            hashing::hash_path,
            hashing::hash_request_sha256,
            hashing::hash_request_sha1,
            hashing::hash_request_md5,
            // Used by 'hybrid_ipc.js'. If app commands ever get an ACL manifest
            // ('tauri_build::AppManifest'), these two must be allowed for every window
            #[cfg(any(windows, target_os = "linux"))]
            ipc_batch::ipc_batch,
            #[cfg(any(windows, target_os = "linux"))]
            ipc_batch::ipc_batch_take,
            logging::next_log_subscription_id,
            processes::list_processes,
            processes::spawn_process,
            processes::kill_process,
            processes::write_process,
            processes::run_process,
            translations::get_locales,
            zip::read_archive_entry,
            zip::unzip_files,
        ]))
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(dispatcher) = app.try_state::<ipc_dispatch::Dispatcher>() {
                    dispatcher.shutdown();
                }
            }
        });
}
