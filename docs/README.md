<div align="center">

<a target="_blank" href="https://bluearchive.wiki/wiki/Arisu">
<img width="128" height="128" align="center" src="../src-tauri/icons/128x128.png" alt="My re-creation of Tendou Arisu's halo">
</a>

<h1>
<a style="color:#a1fee4" href="https://github.com/kaede-basement/kaede">Kaede</a>
</h1>

An extensible Tauri-based Minecraft launcher written in Typescript with Vue

<p align="center">
<strong>English</strong> | <a style="color:#a1fee4" href="./README.ru.md">Русский</a>
</p>

[![star-count]](https://github.com/kaede-basement/kaede/stargazers)
[![vue-badge]](https://vuejs.org/)
[![tauri-badge]](https://v2.tauri.app/)
[![unocss-badge]](https://unocss.dev/)

</div>

## Plans

Kaede is in really early stages of development. Check the [plan](./PLAN.md) to see more about this launcher

## Contributing

You don't need a Rust knowledge to contribute to this project. Almost everything was written in TypeScript using Tauri API. These files will help you:

- [README for JavaScript-related code](../src/README.md) (the most important one)
- [README for Rust-related code](../src-tauri/README.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

I also leave a lot of comments in the code.

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Demonstration

<details>

<div align="center" style="display: grid;grid-template-columns: repeat(3, 1fr); gap: 10px">

nothing here yet

</div>

</details>

## Features

- Plugin system
- Cross-platform
- Available as Non-Portable/Portable
- Open Source, GPL-3.0
- Written in TypeScript

Not implemented yet:

- [ ] Plugin system
  - [ ] Custom CSS themes
  - [ ] Permission-system
  - [ ] Dependencies handling (?)
  - [x] Application hooks
  - [ ] Sandboxed environment using Secure ECMAScript
  - [ ] Unrestricted environment for microfrontends with shared dependencies
  - [ ] Unrestricted environment with `new Function`
- [ ] Authentication
  - [ ] Microsoft authentication
  - [ ] Offline accounts if user has a Microsoft account with the game
  - [ ] Profile systems (?) (basically different launcher settings for different users)
- [ ] Instance management
  - [ ] All Minecraft versions launch
  - [ ] Instance import (from Prism Launcher, Modrinth, etc.)
  - [ ] Instance export
  - [ ] Sandboxed minecraft instances (?)
- [ ] Modpack providers support
  - [ ] CurseForge
  - [ ] Modrinth
  - [ ] ATLauncher
  - [ ] FTB
  - [ ] Legacy FTB
  - [ ] Technic
- [ ] Mod loaders
  - [ ] Fabric
  - [ ] Forge
  - [ ] NeoForge
  - [ ] Quilt
  - [ ] Legacy Fabric
  - [ ] LiteLoader
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
  - [ ] Already installed JDKs detection
  - [ ] Different version selection for supported Minecraft versions
  - [ ] Bundled GraalVM Community Edition JDK (?)
- [ ] Server management (via plugin)
  - [ ] Various server cores (Bukkit-based, Sponge-based, Forge, Fabric, Minestom, etc.)
  - [ ] Plugins management
  - [ ] Mods management

tbd (https://mc-launcher.tayou.org/)

## Installation

### Stable Releases

Download Kaede from the [GitHub Releases](https://github.com/kaede-basement/kaede/releases) page. Packages are available for Linux, Windows, and macOS.

### Development builds

Please understand that these builds are not intended for most users. There may be bugs and other instabilities. You have been warned.

There are development builds available through:

- [GitHub Actions](https://github.com/kaede-basement/kaede/actions) (includes builds from pull requests opened by contributors).
- [nightly.link](https://nightly.link/kaede-basement/kaede/workflows/build/nightly) (this will always point only to the latest version of the `nightly` branch).

Prebuilt Development builds are provided for Linux, Windows, and macOS.

## Community & Support

If you found a bug or want to suggest a feature, please open an issue in [GitHub Issues](https://github.com/kaede-basement/kaede/issues). Pull requests and contributions (code, docs, translations) are welcome!

### Discord

[![discord-banner]](https://discord.gg/zE2XcswKK7)

## Building from Source

<details>

### Preparations

See [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/).

I also recommend installing [bun](https://bun.sh/).

Once you are ready, clone this repository:

```bash
git clone https://github.com/kaede-basement/kaede

```

Navigate to the cloned directory and install project dependencies:

```bash
bun install
```

### Development

Run:

```bash
bun dev
```

### Release

Run:

```bash
bun run build
```

</details>

## License

[![license-badge]](https://github.com/kaede-basement/kaede/blob/main/LICENSE)

<!-- Variables -->

[star-count]: https://img.shields.io/github/stars/kaede-basement/kaede?label=Stars&style=for-the-badge&color=%23a1fee4&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIC05NjAgOTYwIDk2MCIgd2lkdGg9IjI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxwYXRoIGQ9Im0zNTQtMjQ3IDEyNi03NiAxMjYgNzctMzMtMTQ0IDExMS05Ni0xNDYtMTMtNTgtMTM2LTU4IDEzNS0xNDYgMTMgMTExIDk3LTMzIDE0M1pNMjMzLTgwbDY1LTI4MUw4MC01NTBsMjg4LTI1IDExMi0yNjUgMTEyIDI2NSAyODggMjUtMjE4IDE4OSA2NSAyODEtMjQ3LTE0OUwyMzMtODBabTI0Ny0zNTBaIiBzdHlsZT0iZmlsbDogcmdiKDE2MSwgMjU0LCAyMjgpOyIvPgo8L3N2Zz4%3D%0A
[vue-badge]: https://img.shields.io/badge/vuejs-%2335495e.svg?style=for-the-badge&logo=vuedotjs&logoColor=%234FC08D
[tauri-badge]: https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF
[unocss-badge]: https://img.shields.io/badge/unocss-333333.svg?style=for-the-badge&logo=unocss&logoColor=white
[discord-banner]: https://discordapp.com/api/guilds/1422266074908594199/widget.png?style=banner3
[license-badge]: https://img.shields.io/github/license/kaede-basement/kaede?style=for-the-badge
