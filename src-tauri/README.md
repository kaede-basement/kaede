[<<< Back](../docs/README.md#contributing)

- [README for TypeScript-related code](../src/README.md)
- Viewing README for Rust-related code
- [Contributing Guidelines](../docs/CONTRIBUTING.md)
- [MultiMC Patch System](../docs/MULTIMC.md)

# Rust code

This directory includes Tauri-specific code. The [Rust entry point](./src/lib.rs) registers the IPC commands with `tauri::generate_handler!`. Their implementations live in [src/](./src/).

Some notable fields in `tauri.conf.json`:

- `macOSPrivateApi` allows to make the WebView window transparent on macOS.
- `withGlobalTauri` exposes Tauri APIs to the global `window` object. This feature is needed for extensions.
- `app.windows[0].visible` keeps the window hidden at startup. [Frontend initialization](../src/main.ts) shows it once launcher data is ready, or the [extension loader](../src/lib/extensions/show-webview-window.ts) shows it when deferred display is enabled.
- `app.windows[0].title` manages the window title bar.

Portable mode is determined by a `portable.txt` file next to the executable. If the file exists, the launcher runs in portable mode (data stored next to the executable). Otherwise, it uses the system app data directory.

Tauri API permissions are located in `./capabilities/`. Each permission scope has its own separate file.

## Want to help?

- Feel free to do anything :3
