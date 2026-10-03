# Plan

Earlier ideas for each section are kept in [HISTORY.md](./HISTORY.md), to show the path from an initial idea to the final implementation :3

## Todo

<details>

- [ ] Plugin system
    - [x] Custom CSS themes
    - [x] Permission-system (need to add more permissions, though)
    - [ ] Dependencies handling (?)
    - [x] Application hooks
    - [x] Sandboxed environment using Secure ECMAScript
    - [ ] Unrestricted environment for microfrontends with shared dependencies
    - [x] Unrestricted environment with `new Function`
    - [ ] Repository fetching
    - [ ] Downloading from the repository
    - [x] UI to manage plugins
    - [ ] Plugin packs (?)
- [x] Minecraft launching
  - [x] Uses MultiMC meta
  - [x] Caching
  - [x] Precise missing assets/libraries/jars re-download
  - [x] Precise SHA1 mismatched assets/libraries/jars re-download (with the option to disable this)
  - [x] Plugin hooks for every launch step
  - [x] Launching process with the same launch features as Prism Launcher takes up the same amount of time
  - [x] All new release (1.13+) versions work
  - [x] All old release (1.0-1.12.2) versions work
  - [x] All snapshots, beta, and alpha versions work
  - [x] [Custom launch wrapper](https://github.com/MCPHackers/LaunchWrapper) for alpha & beta versions of minecraft
  - [x] Built-in OptiFine patch support
- [x] Authentication
    - [x] Microsoft authentication
    - [x] Offline accounts if user has a Microsoft account with the game
    - [ ] Profile systems (?) (basically different launcher settings for different users)
- [ ] Instance management
    - [x] Isolated instances
    - [ ] Instance import (from Prism Launcher, Modrinth, etc.)
    - [ ] Instance export
    - [ ] Sandboxed minecraft instances (?)
- [ ] Modpack providers support
    - [ ] CurseForge
    - [x] Modrinth
    - [ ] ATLauncher
    - [ ] FTB
    - [ ] Legacy FTB
    - [ ] Technic
- [ ] Mod loaders and OptiFine
    - [x] OptiFine
    - [x] Fabric
    - [x] Forge
    - [x] NeoForge
    - [x] Quilt
    - [x] Legacy Fabric
    - [x] LiteLoader
    - [ ] Kaolin
- [ ] Resource management
    - [ ] Mods
        - [ ] CurseForge blocked download handling via spawning a webview window (?)
        - [ ] Symlinks for identical mods (?)
    - [ ] Resourcepacks
    - [ ] Shaderpacks
    - [ ] Worlds
    - [ ] Datapacks
- [ ] Java management
    - [x] Already installed JDKs detection
    - [x] Custom ones import
    - [ ] Different version selection for supported Minecraft versions
    - [ ] Bundled GraalVM Community Edition JDK (?)

</details>

## UI/UX Design

Whatever my mind thinks is good

## Routing

<details>

### Latest

I simply use `globalStates.currentPage` with string literals to switch components:

```vue
<template>
  <C.Home v-if="page === 'home'" />
  <C.Library v-else-if="page === 'library'" />
  <C.Settings v-else-if="page === 'settings'" />
  <C.AddInstance v-else-if="page === 'add-instance'" />
  <C.Profile v-else-if="page === 'profile'" />
  <!-- This block of elements is shown only when custom pages are selected -->
  <C.PageWrapper v-else>
    <div id="__custom-page__wrapper">
      <component :is="page" />
    </div>
  </C.PageWrapper>
</template>
```

The navigation method is:

```ts
export function navigate(path: RouteType): void {
  globalStates.currentPage = path;
}
```

`globalStates` is simply a `reactive` object:

```ts
/**
 * Contains all global application states.
 * Will be overwritten in 'main.ts' once the global states are ready
 */
export let globalStates: Reactive<GlobalStatesType>;

/**
 * Assign the actual global states to 'globalStates'.
 * This function is called in 'main.ts'
 */
export function declareGlobalStates(): void {
  /*
   * Since global states are deeply reactive,
   * we should copy the original config object to avoid its changes
   */
  const configFile: ConfigType = structuredClone(GlobalInternals.initialConfig);
  const customSettings = DefaultGlobalStatesPagesStates["add-instance"].customSettings;

  globalStates = reactive<GlobalStatesType>({
    ...configFile,
    "contextMenuItems": markRaw(ContextMenuItems),
    "currentPage"     : Router.getInitialPage(),
    "translations"    : markRaw(GlobalInternals.initialTranslations),
    "pages"           : { /* ... */ },
    "sidebarItems"    : markRaw([ /* ... */ ]),
  });
}
```

</details>

## Extensions

<details>

### Latest

See [this file](./EXTENSIONS.md).

</details>

## Auth

<details>

### Latest

See [this file](./AUTHENTICATION.md).

</details>

## Disk Efficient & Isolated Instance Management

<details>

### Latest

Libraries and assets are already shared between instances. As for the mods - maybe some day?

</details>

## Server Management (?)

<details>

### Latest

Will be implemented as a sandboxed plugin.

</details>

## Instances Sandboxing (?)

<details>

### Latest

Will be implemented as a plugin ^^

|         | Utility                                                       |
|---------|---------------------------------------------------------------|
| Windows | [Sandboxie Plus](https://github.com/sandboxie-plus/sandboxie) |
| Linux   | [bubblewrap](https://github.com/containers/bubblewrap)        |
| macOS   | `sandbox-exec`                                                |

For macOS, [minecraft-macos-sandboxing](https://github.com/RayBytes/minecraft-macos-sandboxing) is useful.

</details>

## Deleted Files

<details>

### Latest

No, they will be just deleted. Extensions, however, might implement this idea.

</details>
