README for JavaScript-related code | [README for Rust-related code](../src-tauri/README.md) | [Contributing Guidelines](../docs/CONTRIBUTING.md)

# Frontend & backend code

This folder contains frontend-specific and backend-specific code. The frontend uses Vue.js, the backend uses Tauri JS API. Every single file here uses TypeScript instead of JavaScript.

Let me explain the file structure.

## Top-level files

- `App.vue` is the Vue entry point file.
  - Code-wise, it contains a single `shallowReactive` object that has almost all application states. Gathering application states in a single big `shallowReactive` object is a bad practice, but in this case it allows for extension hooks to have stable, predictable behaviour. With this approach, we also do not need to use `pinia` for global stores.
  - HTML-wise, it contains application's layout with error boundaries.
- `declarations.ts` contain the `window` type definitions. Otherwise, TypeScript will not know about the custom `window.__KAEDE__` object. Note: `HookReturnType`'s second argument accepts `"nothing"` and any other type (including `void`). `void` and `"nothing"` values there serve different purposes:
  - `void` means that the hook returns `{ "status": "stop" | "continue", "response": void }`. Hooks with this type can control whether to continue caller's code execution or not (caller is the function that executes these hooks).
  - `"nothing"` means that the hook returns `void` (or anything else, the caller will just not care about it). Hooks with this type cannot abort caller's code execution.
- `globals.css` contain global CSS styles that are not possible or not convenient to write using the UnoCSS.
- `main.ts` is the main entry point file. It contains all initialization code and imports CSS styles. This code will be executed the first when the webview will be loaded.
- `vite-env.d.ts` is just a default file that `vite` generates.

## Top-level folders

Every folder has its own `README` file for more detailed explanations.

- `__mocks__` contain library mocks and is purely for testing environment. [More](./__mocks__/README.md)
- `components` contain only Vue components. These components are used for the application UI. [More](./components/README.md)
- `constants` contain reusable global constants. [More](./constants/README.md)
- `lib` contains the backend part. [More](./lib/README.md)
- `resources` contain application assets, such as images, GIFs, videos, etc. [More](./resources/README.md)
- `types` contain reusable TypeScript types and interfaces. [More](./types/README.md)