[<<< Back](../README.md)

# Runtime backends

The desktop launcher uses Tauri. Its [Rust entry point](../../src-tauri/src/lib.rs) registers the IPC commands implemented in [src-tauri/src](../../src-tauri/src/).

The frontend also imports [browser](./browser/index.ts) and [Wails](./wails/index.ts) stubs. Both return false from their environment checks in regular builds.

- The [Pages workflow](../../.github/workflows/preview.yml) replaces the browser stub with the implementation from [clanker-experiments](https://github.com/kaede-basement/clanker-experiments) to build the [live demo](https://kaede-basement.github.io/kaede/).
- The [Wails workflow](../../.github/workflows/build-wails.yml) delegates the desktop build to the same repository.
