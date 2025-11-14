[README for JavaScript-related code](../src/README.md) | README for Rust-related code | [Contributing Guidelines](../docs/CONTRIBUTING.md)

# Rust code

This folder contains Tauri-specific code. You won't find much here, because I use Tauri API in JS instead of writing logic directly in Rust.

Let me explain some properties in `tauri.conf.json`:

- `macOSPrivateApi` allows to make webview window transparent on macOS.
- `withGlobalTauri` adds Tauri internals to global `window` object. This is needed for extensions.
- `app.windows[0].visible` makes webview window hidden by default so that user will not see blank screen while webview and frontend are loading. I manually make it visible in the code (check `/src/main.ts`) once Vue finishes mounting.
- `app.windows[0].title` is just a visible title for the window title bar, but it serves an important purpose in Kaede. If launcher build will be portable, then that `title` property must contain a `Portable` string. This is required, because in the logging file initialization (`lib.rs`) I determine whether launcher is portable or not by checking if window title contains a `Portable` string.

Tauri API permissions are located in `./capabilities/`. I made a separate file for every permission scope.
