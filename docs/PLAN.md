# Design

A public figma file

# Plan

## Routing

<details>
I don't see any advantages in using a package for page routes

Just define a global store using `pinia` with fields like this:

```ts
// just a mock-up, i dont remember how pinia stores look like lol
{
  "page"   : "home" // "home" | "library" | "settings" | `custom-${string}`,
  "setPage": (to: /* a type above */) => {
    for (const hook of /* window.[...].hooks */) {
      hook(to); // handle responses maybe
    }

    this.page = to;
  },
  "states": {
    "home"    : {},
    "library" : {},
    "settings": { "tab": "plugins" },
    // plugins can add their own fields
  };
  "setState": (key: string; value: object) {
    // handle hooks

    this.states[key] = value;
  },
};

window.__KAEDE__.router = /* pass the non-reactive object, or properties */
```

and in the `layout.vue`:

```vue
<script setup lang="ts">
const router = useRouterStore();
</script>

<template>
  <...>
    <home-page v-if="router.page === 'home'" />
    <... />
    <custom-page v-else />
  </...>
</template>
```

simple ass.

and!! to make custom layouts even easier to do, we can use a <Teleport /> for each page

plugins will change some state for <Teleport /> to mount a page component on the page change to somewhere
</details>

## Extensions

<details>

### Goal

Allow users to expand launcher's functionality by using extensions that are loaded in runtime

### Implementation

Make a page that fetches extensions from some remote repository

That repository must include only moderated extensions. Moderation process should require extension's source code and, if differs from usual, a build manual. Every extension update must go through the moderation process. This is the only way to make custom extensions secure, I guess

Those extensions should be loaded once at application launch. Programming language must be a JavaScript. Any framework is ok, as long as it is capable running in a browser. Extensions will be able to communicate with the launcher

### More

**Previous implementation details**

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

**Latest implementation details (19.09.2025)**

Microfrontends supremacy >.<

Using a Module Federation Runtime we can load any Vue component just like an ordinary component in the node tree. To make it possible for plugins to render components anywhere, a `<Teleport />` could be used. Module Federation Runtime also allows us to share dependencies, so the final extension budle size should be low.

For other JS frameworks, we can run them using the previous implementation: `new Function`.

Launcher should expose everything that it can through the `window.__KAEDE__`. Previously, communication was done using the `window.postMessage` function, but now I came up with the idea of exposing an array of functions for almost every action in app. That array can be changed by extensions, and then the launcher will execute every function listed in that array.

For example, see the next code:

```ts
/** Launcher */
window.postMessage("kaede-route-changed", /* some data */)

/** Extension */
const handleRouteChange = (pathname: string) => {
  if (pathname === "/home") {
    // do something
  }
};
const handleKaedeMessages = (event: { data: string ) => {
  if (event.data === "tsuki_updated_window") {
    handleRouteChange(/* some data from the 'event', or maybe pass down the 'window.__KAEDE__.dynamic.currentRoute' variable */);

    return;
  }

  // other code
};

window.addEventListener("message", handleKaedeMessages);
```

While it works, it doesn't look good to me. Adding a lot of window listeners can affect launcher's performance. If user has 20 extensions, that `handleKaedeMessages` function will fire on every new event 20 times, even if no one wanted to listen to that event.

Now I'm suggesting the next structure:

```ts
/** Launcher */
window.__KAEDE__.hooks.onRouteChange.before = [];

/** Extension */
const currentRoute = ref<RouteType>("home");

window.__KAEDE__.hooks.onRouteChange.before.push(({ pathname }: { pathname: RouteType }) => {
  currentRoute.value = pathname;
});

/** Launcher */
// example with the '@kitbag/router'
onBeforeRouteChange(() => {
  for (const hook of window.__KAEDE__.hooks.onRouteChange.before) {
    hook({ pathname });
  }
});
```

Extensions are not needed to listen for window events anymore. Only specified actions will be triggered. Must be a perfect solution? Maybe. I'm not sure that this will work, because, well, launcher doesn't have the same scope as that extension code block where `window.__KAEDE__` was reassigned (?)

Update: it works, somehow. I tested it both ways: firstly, I made a Svelte plugin state change from the Launcher (in Vue), and then I made a Vue state change from the Svelte plugin.

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
