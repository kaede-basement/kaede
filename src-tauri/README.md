# Rust code

This folder contains Tauri-specific code. You won't find much here, because I use Tauri API in JS instead of writing logic directly in Rust.

Let me explain some properties in `tauri.conf.json`:

- `macOSPrivateApi` allows to make webview window transparent on macOS.
- `withGlobalTauri` adds Tauri internals to global `window` object. This is needed for extensions.
- `app.windows[0].visible` makes webview window hidden by default so that user will not see blank screen while webview and frontend are loading. I manually make it visible in the code (check `/src/main.ts`) once Vue finishes mounting.

Tauri API permissions are located in `./capabilities/`.