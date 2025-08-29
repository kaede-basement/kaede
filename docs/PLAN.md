# Design

A public figma file

# Plan

## Extensions

<details>

### Goal

Allow users to expand launcher's functionality by using extensions that are loaded in runtime

### Implementation

Make a page that fetches extensions from some remote repository

That repository must include only moderated extensions. Moderation process should require extension's source code and, if differs from usual, a build manual. Every extension update must go through the moderation process. This is the only way to make custom extensions secure, I guess

Those extensions should be loaded once at application launch. Programming language must be a JavaScript. Any framework is ok, as long as it is capable running in a browser. Extensions need to be able to communicate with launcher

### More

Any JS code can be dynamically fetched in runtime from somewhere and executed with the `new Function` constructor. Example (I implemented it in [one of my projects](https://github.com/notwindstone/tsuki)):

```ts
const url = "..."; // an endpoint containing bundled JS code (with CSS styles, etc.)
const response = await fetch(url);
const pluginCode = await response.text();
// 'module' and 'exports' are required to load non-vanilla JS
const initPlugin = new Function("module", "exports", pluginCode);

initPlugin({ exports: {} }, {});
```

Looks simple, but works like a charm. I didn't figure how to share dependencies yet, though. There is also a [module federation runtime](https://www.npmjs.com/package/@module-federation/runtime) thing, I need to look at it sometime lol

Now, about the launcher and plugin communication. I didn't find anything better than `window.postMessage`, so I will stick with it. Variables can be shared using the `window.__KAEDE__` object, and Tauri functionality is already exposed that way (`window.__TAURI__`) thanks to `withGlobalTauri` parameter in `tauri.conf.json`

The biggest concern here is the security. Even if the `new Function` can't access local variables, because it runs in a different scope, it still has a lot (and I mean really a lot) of other security issues. Executing an unknown code (especially with the access to some Tauri bindings) is a **horrible** thing

Unfortunately, if VSCode, Obsidian, Vencord and other apps can't implement a secure user plugin system, I won't be able to do it too. In this case it's either functionality or security, not both

Btw, Figma chose security over functionality with their `iframe` approach

</details>

## Auth

<details>

### Goal

Users should be able to sign in using their Microsoft, Ely.by, [LittleSkin](https://littleskin.cn/) and offline accounts without any restrictions. Ely.by method should also use some client patching to make skins visible everywhere

### Implementation

Well, not so much clue yet. But this [amazing article](https://dreta.dev/blog/2023/08/15/how-minecraft-launchers-work/) by [Dreta](https://github.com/dreta) should help

Also notable:

- [Ely.by docs](https://docs.ely.by/en/index.html)
- [Drasl](https://github.com/unmojang/drasl)

### Thoughts

None

</details>

## Disk Efficient & Isolated Instance Management

<details>

### Goal

Make a disk efficient way to manage isolated instances. Share mods, and maybe libraries, assets (?)

### Implementation

No clue

### Thoughts

Hard to implement (bruh how do I even create a symlink using Tauri API), need thorough planning

</details>

## Server Management (?)

<details>

### Goal

A server management utility to handle Minecraft servers

### Implementation

It could be implemented as an extension. Downloading server jar should be possible using `window.__TAURI__.upload`, launching it should be possible using `window.__TAURI__.shell`

### Thoughts

None

</details>

## Instances Sandboxing (?)

<details>

### Goal

Not allowing [this](https://github.com/trigram-mrp/fractureiser) type of situations to happen in the future

### Implementation

Instance isolation for Linux can be made using a [bubblewrap](https://github.com/containers/bubblewrap). See this [cool article](https://ersei.net/en/blog/isolate-minecraft) for more

### Thoughts

https://github.com/PrismLauncher/PrismLauncher/issues/1146

</details>

## Deleted Files

<details>

### Goal

Mark files, that are deleted directly in launcher, as trashed. Trashed files should be shown on some page, should be recoverable and should be automatically deleted after configurable time. Users must have an ability to disable this feature

### Implementation

Instead of deleting, change file extension to something like `.trashed`

### Thoughts

None

</details>
