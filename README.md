## tech stack

- Tauri 2.0
- Vue.js 3.6 in Vapor mode
- UnoCSS with presetWind3

## plan

### auth options

<details>

Users should be able to sign in using their Microsoft, Ely.by, [LittleSkin](https://littleskin.cn/) and offline accounts

**Current implementation idea:** tbd

**Results:** tbd

</details>

### extensions

<details>

JS code can be dynamically fetched from somewhere and then executed with the `new Function(JS_CODE_AS_STRING)`. That is a key idea for implementing user plugin system. Plugins can communicate with the host app and each other through `window.postMessage`, and the variables can be shared using the `window` object. JS code can also handle applying CSS styles, adding DOM nodes, etc. Any fully CSR JS framework will work perfectly.

The biggest concern here is the security. Even if the `new Function` can't access local variables and runs in a different scope (unlike `eval`), it still has a lot (and I mean really a lot) of other security issues. Executing an unknown code (especially with the access to the filesystem) is a **horrible** thing

Unfortunately, if VSCode, Obsidian, Vencord and other apps can't implement a secure user plugin system, I won't be able to do it too. It's either functionality or security, not both

**Current implementation idea:** An extension repository that hosts moderated plugin versions. Moderation will require only a source code and, if differs from usual, build manual. Plugins will run only once on application load, without blocking the main thread

**Results:** custom elements, insane UI customization, etc.

</details>

### server management (maybe?)

<details>

A built-in server management utility to handle simple minecraft servers. Nothing complex (at least for now), just the ability to launch a Paper/Forge/Fabric server on a specified version for those, who don't know how to make a minecraft server. Also show a [playit.gg](https://playit.gg/) link

**Current implementation idea:** Download a server jar using `@tauri-apps/plugin-upload` and launch it with the `tauri-apps/plugin-shell`

**Results:** ability to launch a server for friends

</details>

### sandboxing (maybe?)

<details>

* Launcher-level: tauri capabilities is the first thing that comes to the mind. Tho it is surely not enough, especially with user extensions.

* Instance-level: see https://ersei.net/en/blog/isolate-minecraft and https://github.com/PrismLauncher/PrismLauncher/issues/1146

**Current implementation idea:** no clue. Instance isolation for Linux can be implemented using a [bubblewrap](https://github.com/containers/bubblewrap)

**Results:** https://github.com/trigram-mrp/fractureiser

</details>

## design

tbd

## testing

- vitest
- playwright
