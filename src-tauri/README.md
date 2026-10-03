[<<< Back](../docs/README.md#contributing)

- [README for TypeScript-related code](../src/README.md)
- Viewing README for Rust-related code
- [Contributing Guidelines](../docs/CONTRIBUTING.md)
- [MultiMC Patch System](../docs/MULTIMC.md)

# Rust code

This directory includes Tauri-specific code. Functionality was mainly written with the TypeScript, so this folder does not contain much Rust code.

Some notable fields in `tauri.conf.json`:

- `macOSPrivateApi` allows to make the WebView window transparent on macOS.
- `withGlobalTauri` exposes Tauri APIs to the global `window` object. This feature is needed for extensions.
- `app.windows[0].visible` makes the WebView window hidden by default to eliminate blank screen for the WebView loading state. Once the Vue instance is mounted, `../src/lib/initialization/finish.ts` makes the application window visible. If extensions and the `showAppAfterExtensionsLoad` setting are enabled, the window is shown after extensions load instead (`../src/components/general/extensions/ExtensionLoader.vue`), and if startup fails before that, `../src/main.ts` shows it to display the error.
- `app.windows[0].title` manages the window title bar.

Portable mode is determined by a `portable.txt` file next to the executable. If the file exists, the launcher runs in portable mode (data stored next to the executable). Otherwise, it uses the system app data directory.

Tauri API permissions are located in `./capabilities/`. Each permission scope has its own separate file.

The `./src` directory includes custom Tauri commands; `tauri::generate_handler!` in `./src/lib.rs` lists all of them.

## Want to help?

- Feel free to do anything :3
