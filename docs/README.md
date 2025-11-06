<div align="center">

<img width="128" height="128" align="center" src="../src-tauri/icons/128x128.png" alt="Favicon">

<h1>
<a style="color:#ff637e" href="https://github.com/freesmteam/kaede">Kaede</a>
</h1>

An extensible Tauri-based Minecraft launcher written with Vue and Tauri

<p align="center">
<strong>English</strong> | <a style="color:#ff637e" href="./README.ru.md">Русский</a>
</p>

[![star-count]](https://github.com/freesmteam/kaede/stargazers)
[![vue-badge]](https://vuejs.org/)
[![tauri-badge]](https://v2.tauri.app/)
[![unocss-badge]](https://unocss.dev/)

</div>

## Plans

Kaede is not even in a development stage yet. Check the [plan](./PLAN.md) to see more about this launcher

## Contributing

You don't need a Rust knowledge to contribute to this project. Almost everything was written in TypeScript using Tauri API. These files will help you:

- [README for JavaScript-related code](../src/README.md) (the most important one)
- [README for Rust-related code](../src-tauri/README.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

I also leave a lot of comments in the code.

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Demonstration

A video demonstration of the isolated plugin that renders an interactive Live2D of [Misono Mika](https://bluearchive.wiki/wiki/Mika). Isolated plugin has the access to DOM (`document`); also can use `window.log` (a custom logger function that wraps tauri-plugin-log), `Math`, `Date`, `URL`, `Buffer`, `window["__core-js_shared__"]`, `console`, etc. This list is not full because it is really long, and the key thing here is that we can manually pass down global variables, so important and dangerous `window.__TAURI__.*` functions are not accessible.

Isolation was done using the [Secure ECMAScript](https://github.com/endojs/endo). All globals were frozen using the `lockdown` function that `ses` library provides. So plugins can't rewrite any globals, prototypes, etc.

Interactive Live2Ds were taken from [Z_DK's Steam Workshop](https://steamcommunity.com/id/xingsuileixi/myworkshopfiles/?appid=431960)

<details>
I need to take care of DOM script tags that plugins can add when have the DOM access. Otherwise, this sandbox can be escaped. Maybe I can overwrite the `document.createElement` before freezing it? And just to be sure, listen for `head` element changes for possible script tag additions?

Update: Seems like giving DOM access to the compartment basically ruins the whole purpose of plugin isolation, since one can add a JS code to any DOM element that will be executed in the global scope.

Well, let's make these permissions then?

- Full DOM access
- File System access (window.__TAURI__.fs)
- System shell access (window.__TAURI__.shell)
- ...other Tauri-specific plugins access

How to adapt to these rules? Do I really need compartments here? Isn't it better to just use `new Function` at this point? What to do about script tags and the above DOM element JS executions? Should I expose Tauri API through `window` object? How to import and share Tauri API then?

---

After some thoughts, I decided to go with this approach:

Tauri API **will not** be exposed through `window`

Account sign in is made through another webview window with no plugin access to prevent any possible security vulnerabilities.

- Kaede Add-ons User Repository (KAUR) - plugins that are free to publish for anyone. Will use Secure ECMAScript Compartments for not full DOM access, otherwise they are executed with `new Function`
- Moderated plugins - every plugin publish/update goes through my checks. I only need plugin's source code and build manual. Executed with `new Function` or `Module Federation Runtime API`, have full DOM access by default, only require Tauri API scope permissions (fs, shell, global shortcuts, network, os info, etc.) from user

Permissions:

Runs in compartment:

- CSS: Apply CSS stylesheet                    - Custom
- |    Edit/replace element class list (by id)
- |    Edit element styles (by id)

Runs in `new Function` or Module Federation Runtime API (`eval`):

Note: I need to generalize these, because seeing 30 permissions that vary from doing 1 simple ass thing (tauri-core-app) to doing 50+ dangerous things (tauri-plugin-fs/tauri-plugin-shell) is not ok

- Website capabilities: everything that HTML & JS & CSS offers (no access to Tauri API)
- Tauri Core: Allow to change application theme (not the UI) - App
- |           Emit/listen events to/from the backend         - Event
- |           Create images from paths                       - Image
- |           Menu
- |           Path
- |           Resources
- |           Tray
- |           WebViews & windows management
- Tauri Plugins:
- plugin-drpc (i will format these a bit later)
- plugin-fs
- plugin-http
- plugin-log
- plugin-notification
- plugin-opener
- plugin-os
- plugin-process
- plugin-shell
- plugin-upload

not related, but need to store it somewhere:

context menu has 50000 z-index
log menu     has 40000 z-index
sidebar      has 3000 z-index

Update: apparently, this shit is not going to work because tauri exposes __TAURI_INTERNALS__ to the `window` object. Nothing I can do about it, right?

Update: yeah, `window.__TAURI_INTERNALS__` are frozen. But even if I somehow disable freezing, clone the `window.__TAURI_INTERNALS__.invoke` function, overwrite/delete it, and freeze the whole `window.__TAURI_INTERNALS__`, Tauri will just break since it accesses invokes from `window` (even in rust).

Now I need to make some safe fine-grained permission system that manually exposes some JS capabilities, safe DOM wrappers, app functions and variables, Tauri-specific scopes, and only then the whole unrestricted environment (for DOM and full Tauri API). (Also need to take care of `plugin-shell` that allows to execute `java` with any arguments. Maybe not allow it unless unrestricted environment?)

restricted environment will run in compartments, unrestricted environment is basically a `new Function` or `eval` in case of Module Federation Runtime API.

Also, not related to extensions, but I can implement a `temporary launcher version switcher` that will fetch the JS code, save it in the directory somewhere that JS bindings can't access, and execute it instead of the bundled into the launcher JS assets.
</details>

If there is no video, [click here](https://github.com/user-attachments/assets/a1ccc9f2-0244-437b-8883-a68a26953e2a)

<video src="https://github.com/user-attachments/assets/a1ccc9f2-0244-437b-8883-a68a26953e2a" width="320" height="240" controls></video>

<details>

<div align="center" style="display: grid;grid-template-columns: repeat(3, 1fr); gap: 10px">

nothing here yet

</div>

</details>

## Features

- Cross-platform
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

If you found a bug or want to suggest a feature, please open an issue in [GitHub Issues](https://github.com/FreesmTeam/FreesmLauncher/issues). Pull requests and contributions (code, docs, translations) are welcome!

### Discord

[![discord-banner]](https://discord.gg/zE2XcswKK7)

## Building from Source

<details>

### Preparations

See [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/).

I also recommend installing [bun](https://bun.sh/).

Once you are ready, clone this repository:

```bash
git clone https://github.com/freesmteam/kaede

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

[![license-badge]](https://github.com/freesmteam/kaede/blob/main/LICENSE)

<!-- Variables -->

[star-count]: https://img.shields.io/github/stars/freesmteam/kaede?label=Stars&style=for-the-badge&color=%23ff637e&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIC05NjAgOTYwIDk2MCIgd2lkdGg9IjI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxwYXRoIGQ9Im0zNTQtMjQ3IDEyNi03NiAxMjYgNzctMzMtMTQ0IDExMS05Ni0xNDYtMTMtNTgtMTM2LTU4IDEzNS0xNDYgMTMgMTExIDk3LTMzIDE0M1pNMjMzLTgwbDY1LTI4MUw4MC01NTBsMjg4LTI1IDExMi0yNjUgMTEyIDI2NSAyODggMjUtMjE4IDE4OSA2NSAyODEtMjQ3LTE0OUwyMzMtODBabTI0Ny0zNTBaIiBzdHlsZT0iZmlsbDogcmdiKDI1NSwgOTksIDEyNik7Ii8%2BCjwvc3ZnPg%3D%3D%0A
[vue-badge]: https://img.shields.io/badge/vuejs-%2335495e.svg?style=for-the-badge&logo=vuedotjs&logoColor=%234FC08D
[tauri-badge]: https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF
[unocss-badge]: https://img.shields.io/badge/unocss-333333.svg?style=for-the-badge&logo=unocss&logoColor=white
[discord-banner]: https://discordapp.com/api/guilds/1422266074908594199/widget.png?style=banner3
[license-badge]: https://img.shields.io/github/license/freesmteam/kaede?style=for-the-badge
