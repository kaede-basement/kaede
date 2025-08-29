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

Now, about the launcher and plugin communication. I didn't find anything better than `window.postMessage`, so I will stick with it. Variables can be shared using the `window.__KAEDE__` object, and tauri functionality is already exposed that way (`window.__TAURI__`) thanks to `withGlobalTauri` parameter in `tauri.conf.json`

The biggest concern here is the security. Even if the `new Function` can't access local variables, because it runs in a different scope, it still has a lot (and I mean really a lot) of other security issues. Executing an unknown code (especially with the access to some Tauri bindings) is a **horrible** thing

Unfortunately, if VSCode, Obsidian, Vencord and other apps can't implement a secure user plugin system, I won't be able to do it too. In this case it's either functionality or security, not both

Btw, Figma chose security over functionality with their `iframe` approach

</details>

## Auth

<details>

### Goal

Users should be able to sign in using their Microsoft, Ely.by, [LittleSkin](https://littleskin.cn/) and offline accounts without any restrictions.

### Implementation

### Thoughts

</details>

manage all file deletions as 'recycle bin'. all trashed files should be shown on some page and also automatically deleted after configurable time. also provide user with a choice of disabling 'recycle bin' feature.
