<div align="center">

<img width="128" height="128" align="center" src="../src-tauri/icons/128x128.png" alt="Favicon">

<h1>
<a style="color:#ff637e" href="https://github.com/freesmteam/kaede">Kaede</a>
</h1>

[WIP] An extensible Tauri-based Minecraft launcher written in Vue and Rust

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

[Contributing Guide](./CONTRIBUTING.md)

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Demonstration

A video demonstration of the isolated plugin that renders an interactive Live2D of [Misono Mika](https://bluearchive.wiki/wiki/Mika). Isolated plugin has the access to DOM (`document`); also can use `window.log` (a custom logger function that wraps tauri-plugin-log), `Math`, `Date`, `URL`, `Buffer`, `window["__core-js_shared__"]`, `console`, etc. globals. This list is not full because it is really long, and the key thing here is that we can manually pass down global variables, so important and dangerous `window.__TAURI__.*` functions are not accessible.

Isolation was done using the [Secure ECMAScript](https://github.com/endojs/endo). All globals were frozen using the `lockdown` function that `ses` library provides. So plugins can't rewrite any globals, prototypes, etc.

Interactive Live2Ds were taken from [Z_DK's Steam Workshop](https://steamcommunity.com/id/xingsuileixi/myworkshopfiles/?appid=431960)

One more thing: we need to take care of DOM script tags that plugins can add when have the DOM access. Otherwise, this sandbox can be escaped. Maybe we can overwrite the `document.createElement` before freezing it? And just to be sure, listen for `head` element changes for possible script tag additions?

![Misono Mika](./demos/misono_mika_l2d_as_a_plugin.mp4)

<details>

<div align="center" style="display: grid;grid-template-columns: repeat(3, 1fr); gap: 10px">

nothing here yet

</div>

</details>

## Features

tbd

## Comparison

tbd (https://mc-launcher.tayou.org/)

## Installation

tbd

## Community & Support

If you found a bug or want to suggest a feature, please open an issue in [GitHub Issues](https://github.com/FreesmTeam/FreesmLauncher/issues). Pull requests and contributions (code, docs, translations) are welcome!

### Discord

[![discord-banner]](https://freesmlauncher.org/discord)

## Building from Source

<details>

### Preparations

See [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/).

We also recommend installing [bun](https://bun.sh/).

Once you are ready, clone this repository:

```bash
git clone https://github.com/freesmteam/kaede

```

Navigate to cloned directory and install project dependencies:

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
[discord-banner]: https://discordapp.com/api/guilds/1332079164341354506/widget.png?style=banner3
[license-badge]: https://img.shields.io/github/license/freesmteam/kaede?style=for-the-badge
