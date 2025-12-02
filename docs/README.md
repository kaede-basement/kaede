The development of the app was put on hold for a while due to exams

// temporary: declarative approach to launcher configurations, extensions and instances,
// i.e. each instance will specify its libraries, mods, resource packs, shader packs, and other things
// in the `.json` file, and the launcher will build symlinks to these files (multimc meta can be used)
// on instance launch (either ahead-of-time or on the fly)

<div align="center">

<a target="_blank" href="https://bluearchive.wiki/wiki/Arisu">
<img width="128" height="128" align="center" src="../src-tauri/icons/128x128.png" alt="My re-creation of Tendou Arisu's halo">
</a>

<h1>
<a style="color:#a1fee4" href="https://github.com/kaede-basement/kaede">Kaede</a>
</h1>

A Tauri-based Minecraft launcher written in TypeScript with a permission-based plugin system

<p align="center">
<strong>English</strong> | <a style="color:#a1fee4" href="./README.ru.md">Русский</a>
</p>

[![star-count]](https://github.com/kaede-basement/kaede/stargazers)
[![vue-badge]](https://vuejs.org/)
[![tauri-badge]](https://v2.tauri.app/)
[![unocss-badge]](https://unocss.dev/)

</div>

## Plans

Kaede is in really early stages of development. Look at the [plan](./PLAN.md) to see more about this launcher >.<

## Contributing

No prior Rust knowledge is needed to contribute to this project. Most of the code was written in TypeScript using the Tauri API. These files will help in contributing:

- [README for TypeScript-related code](../src/README.md) (the most important one)
- [README for Rust-related code](../src-tauri/README.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Building from Source](#building-from-source)

I also leave comments in the code.

For launcher plugins, themes, or translations:
- [Making a Plugin](./EXTENSIONS.md#making-a-plugin)
- [Making a Theme](./EXTENSIONS.md#making-a-theme)
- [Translating the Launcher](https://github.com/kaede-basement/translations)

Pull requests are welcome. AI code is not welcome. For major changes, please open an issue first to discuss what you would like to change.

## Demonstration

<div align="center" style="display: grid;grid-template-columns: repeat(2, 1fr); gap: 10px">

<img src="./demos/home-page__blue-archive-bg.png" alt="Home page with the Morizuki Suzumi L2D background image">
<img src="./demos/multi-window__blue-archive-different-bgs.jpg" alt="Multi-Window navigation with different Blue Archive background images">
<img src="./demos/log-viewer__logs.png" alt="Log Viewer">
<img src="./demos/home-page__blank-with-fps-counter.png" alt="Home page with FPS counter">

</div>

<details>

<div align="center" style="display: grid;grid-template-columns: repeat(3, 1fr); gap: 10px">

nothing here yet

</div>

</details>

## Features

- Plugin system
- Cross-platform
- Fast startup
- Uses just 140 MBs of RAM (without plugins)
- MultiMC-like instance management
- Available as Non-Portable/Portable
- Open Source, GPL-3.0
- Written in TypeScript

## Installation

### Stable Releases

Download Kaede from the [GitHub Releases](https://github.com/kaede-basement/kaede/releases) page. Packages are available for Linux, Windows, and macOS.

### Development builds

Please understand that these builds are not intended for most users. There may be bugs and other instabilities.

The development builds are available through:

- [GitHub Actions](https://github.com/kaede-basement/kaede/actions) (includes builds from pull requests opened by contributors).
- [nightly.link](https://nightly.link/kaede-basement/kaede/workflows/build/nightly) (this link will always point only to the latest version of the `nightly` branch).

Prebuilt Development builds are provided for Linux, Windows, and macOS.

## Community & Support

If you want to report a bug or suggest a feature, please open an issue in [GitHub Issues](https://github.com/kaede-basement/kaede/issues).

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
