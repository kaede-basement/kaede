[<<< Back](../docs/README.md#contributing)

- Viewing README for TypeScript-related code
- [README for Rust-related code](../src-tauri/README.md)
- [Contributing Guidelines](../docs/CONTRIBUTING.md)
- [MultiMC Patch System](../docs/MULTIMC.md)

# Frontend & backend code

This folder contains frontend-specific and backend-specific code. The frontend uses Vue.js, and the backend uses Tauri API. Type checks are provided by TypeScript (build time) and [TypeBox](https://github.com/sinclairzx81/typebox) (runtime).

## Entry points

- [main.ts](./main.ts) reads the initial launcher data, initializes shared state and mounts Vue.
- [App.vue](./App.vue) defines the application layout and error boundaries.
- [declarations.ts](./declarations.ts) defines the extension-facing `window.__KAEDE__` API. The [hook return type](./types/extensions/hook-return.type.ts) distinguishes hooks that can stop the caller from hooks whose result the caller ignores.

## Source layout

- [components/](./components/README.md) contains the UI. [composables/](./composables/) holds reusable Vue logic.
- [states/](./states/) holds the reactive state shared across components and extensions. The [configuration watcher](./lib/watchers/watch-config-sync.ts) watches extension-added global fields whose names start with `config/`.
- [extendable/](./extendable/) exposes registries that plugins can change. The [metadata schema](./lib/schemas/types/extensions/index.ts) defines the fields accepted in a plugin’s `metadata.json`.
- [lib/](./lib/) contains launcher logic and [backend adapters](./lib/README.md). [__mocks__/](./__mocks__/README.md) provides library mocks for tests.
- [constants/](./constants/), [resources/](./resources/) and [types/](./types/) hold shared constants, assets and TypeScript definitions.

## Bundle size

Run `bun run generate:bundle-analysis` to build the frontend and write a per-package size report to `bundle-analysis.html`.
