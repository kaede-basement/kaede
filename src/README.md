[<<< Back](../docs/README.md#contributing)

- Viewing README for TypeScript-related code
- [README for Rust-related code](../src-tauri/README.md)
- [Contributing Guidelines](../docs/CONTRIBUTING.md)
- [MultiMC Patch System](../docs/MULTIMC.md)

# Frontend & backend code

This folder contains frontend-specific and backend-specific code. The frontend uses Vue.js, and the backend uses Tauri API. Type checks are provided by TypeScript (build time) and [TypeBox](https://github.com/sinclairzx81/typebox) (runtime).

## Top-level files

- `App.vue` is the Vue entry point file. It contains an application layout with error boundaries.
- `declarations.ts` contain the `window` type definitions. Without those definitions, TypeScript does not know about the custom `window.__KAEDE__` namespace. Note: the second argument of the `HookReturnType` type accepts `"nothing"` and any other type (including `void`). However, `void` and `"nothing"` values serve different purposes:
  - `void` means that the hook returns `{ "status": "stop" | "continue", "response": void }`. Hooks with this type can control whether to continue caller's code execution or not (caller is the function that executes these hooks).
  - `"nothing"` means that the hook returns `void` (or anything else, the caller will just not care about it). Hooks with this type cannot abort caller's code execution.
- `globals.css` contain global CSS styles that are not possible or not convenient to write using the UnoCSS.
- `main.ts` is the main entry point file. It handles all initialization code and CSS styles. This code will be executed the first when the WebView will load.
- `vite-env.d.ts` is simply a default file that the `vite` bundler generates.

## Top-level folders

Some folders have their own `README` file for more detailed explanations.

- `__mocks__` contain library mocks that exist purely for the testing environment. [More](./__mocks__/README.md)
- `components` contain only Vue components. Those components are used in the application UI. [More](./components/README.md)
- `composables` contain reusable Vue composables (`use*` functions).
- `constants` contain reusable global constants.
- `extendable` contains the registries and the global object that plugins can change (`window.__KAEDE__`).
- `lib` contains the backend part. [More](./lib/README.md)
- `resources` contain application assets, i.e. images, GIFs, or videos.
- `states` contain the global reactive states, e.g. `globalStates` in `global.ts`.
- `types` contain reusable TypeScript types and interfaces.

> [!IMPORTANT]
> Gathering application states in one place is discouraged and considered to be amateurish. Not only this practice goes against all software developing principles, but it also introduces less manageable state structure in the whole application.
>
> **However**, this practice allows Kaede to have global states that are easily accessible and extensible by user plugins. For example, a plugin can add a new field to the deeply `reactive` `globalStates` object, and other plugins can use that field for their needs. A field whose key starts with `config/` is also saved to the configuration file (see `lib/watchers/watch-config-sync.ts`).
>
> Moreover, this approach allows extension hooks to have a well-defined behaviour, since all global states are module-level objects in `states/` and do not disappear with the component unmount. One can suggest `Pinia` to manage global stores, but according to [Pinia docs [1]](#references), "you cannot add a new state property if you don't define it in `state()`."

## Bundle size

Run `bun run generate:bundle-analysis` to build the frontend and write a per-package size report to `bundle-analysis.html`.

# References

- [[1] Pinia Documentation: Accessing the state](https://pinia.vuejs.org/core-concepts/state.html#Accessing-the-state)
