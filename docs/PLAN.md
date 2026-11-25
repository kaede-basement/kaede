# Plan

The [earlier plan](https://github.com/kaede-basement/kaede/blob/228bc0d6ef7d9241570096f6ae7e40a7cddede0a/docs/PLAN.md) preserves the original design notes.

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

The [router](../src/lib/router/) uses the current page in [global state](../src/states/global.ts) to select the active view.

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
