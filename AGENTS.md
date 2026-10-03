# Kaede

A Tauri-based Minecraft launcher written in TypeScript with a permission-based plugin system. The point of the project is that users change the launcher at runtime with their own code: new features, a different UI, community plugins and themes. Contributor documentation starts at [`docs/README.md`](docs/README.md#contributing); conventions (naming, commit messages) are in [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

## What matters

- **Everything is extendable.** Application state lives in `src/states/` (`globalStates` is a deep `reactive`, the others are `shallowReactive`) rather than in components or Pinia stores, because plugins must be able to add fields to it at runtime and Pinia only allows fields declared in `state()`. Unrestricted plugins get lifecycle hooks through `src/lib/extension-api/` and `window.__TAURI__`, which is why `withGlobalTauri` stays on. Every element gets a unique ID of the form `__block__element` (e.g. `__profile-page__skin-canvas`) so themes and plugins can target it; the lint rule `@vue-require-id/require-id` only warns when an ID is missing. Hiding state inside a component or rendering an element without an ID makes the launcher less extendable.
- **Plugins come in two trust levels.** Sandboxed plugins get only permission-gated APIs (`src/constants/permissions.ts`, handlers in `src/lib/permissions/atomic/`), and the user approves each permission. Unrestricted plugins run with full access and are allowed only when their code hash is in the owner's trusted list or the user allows untrusted ones. Anything new a sandboxed plugin can do goes through a permission handler that the host checks; never hand a sandboxed plugin a launcher object, a Tauri API or a DOM node directly.
- **Light and old-platform friendly.** The launcher runs on Windows 7 (WebView2 109), on macOS "Old Safari" builds (`kaede-extra.json` `oldSafari` → Vite target `safari13`) and on Linux WebKitGTK. It uses about 120 MB at idle and an unrestricted plugin adds 1–2 MB; measure memory and startup before adding a per-plugin, per-window or always-on cost, and check that new web APIs exist on those engines.

## Three backends, one frontend

The frontend imports `@tauri-apps/*` everywhere. `src/lib/__wails/` translates each Tauri IPC call to a Go service in `src-wails/`, and `src/lib/__browser/` replicates calls with browser APIs for the live demo. Source always imports the no-op stubs `src/lib/browser/` and `src/lib/wails/`; CI moves `__browser/` (`.github/workflows/preview.yml`) or `__wails/` (`.github/workflows/build-wails.yml`) over them before building those variants, so the replicas run locally only after the same swap, and `vue-tsc` skips them (`tsconfig.app.json` excludes both folders).

A new Tauri command therefore touches four places: the Rust function and `generate_handler!` in `src-tauri/src/lib.rs`, `src/lib/__browser/scopes/placeholder-invoke.ts`, `src/lib/__wails/scopes/wails-invoke.ts`, and a Go service in `src-wails/`.

## Map

| Path | Purpose |
| --- | --- |
| `src/components/` | Vue components by page (`home`, `library`, `settings`, …). |
| `src/lib/` | Application logic by domain (`launcher`, `auth`, `extensions`, `permissions`, `configs`, …). |
| `src/states/`, `src/extendable/` | Application state and the registries plugins extend. |
| `src/composables/` | Vue composables (log stream, skin renderer, context menu, …). |
| `src/lib/schemas/types/` | TypeBox schemas; `src/lib/schemas/generated/` is generated from them. |
| `src/lib/txiki/`, `src-tauri/binaries/` | The txiki.js sidecar (`externalBin`) that serves code and sockets for plugins. |
| `src-tauri/` | Rust backend: commands, launcher process handling, log streaming, extension archives. |
| `src-wails/` | Go backend for Wails v3, a replica of the Tauri backend. |
| `types/kaede-lib.d.ts` | Type declarations for plugin authors, generated from `src/declarations.ts`. |
| `scripts/` | Validator generation and the Windows 7 build checks. |
| `docs/` | User and contributor documentation; `docs/EXTENSIONS.md` describes plugins and themes. |

## Commands

```bash
bun install
bun run dev                    # Tauri app with the Vite dev server
bun run test                   # bun test with bun.setup.ts preloaded
bun run typecheck              # vue-tsc
bun run lint                   # ESLint; most rules are warnings
bun run generate:validators    # after changing src/lib/schemas/types/
bun run generate:types         # after changing what src/declarations.ts exposes to plugins
```

Rust code builds inside the flake's dev shell: `nix develop --command bash -c 'cd src-tauri && cargo test --lib'`; elsewhere follow the Tauri v2 prerequisites. The dev shell has no Go toolchain for `src-wails/`.
