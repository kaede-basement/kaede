[README for JavaScript-related code](../src/README.md) | README for Rust-related code | [Contributing Guidelines](../docs/CONTRIBUTING.md)

# Rust code

This directory includes Tauri-specific code. Functionality was mainly written with the TypeScript, so this folder does not contain much Rust code.

Some notable fields in `tauri.conf.json`:

- `macOSPrivateApi` allows to make the WebView window transparent on macOS.
- `withGlobalTauri` exposes Tauri APIs to the global `window` object. This feature is needed for extensions.
- `app.windows[0].visible` makes the WebView window hidden by default to eliminate blank screen for the WebView loading state. Once the Vue instance finishes mounting (`../src/main.ts`), the application window becomes visible.
- `app.windows[0].title` manages the window title bar. However, due to my skill issues with Rust, this field is used to determine whether the launcher is portable or not. The present launcher initialization code (`./src/lib.rs`) checks if the window title contains a `Portable` string, where yes equals to application being in the portable version.

Tauri API permissions are located in `./capabilities/`. Each permission scope has its own separate file.

The `./src` directory includes (but is not limited to) custom Tauri commands to:

- Re-create the `latest.log` file.
- Get the executable file directory.
- Extract the `.zip` archive contents.
- Keep the track of how many times the application was reloaded.
- Get the system and process memory bytes.

## Want to help?

- Current `Portable` mode checks suck.
- Counting the launcher UI reloads is done with `unsafe` keyword.
- The process memory values returned by `get_process_memory` in [system.rs](./src/system.rs) are incorrect on Windows (might be true for other platforms as well).
- Feel free to do something else :3