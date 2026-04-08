# Extensions

## General

### Repositories

Kaede has two built-in plugin repositories.

The first one is a [Kaede Add-ons User Repository (KAUR)](https://github.com/kaede-basement/kaur), similar to [AUR](https://aur.archlinux.org/) and [nixpkgs](https://github.com/NixOS/nixpkgs). This repository contains user published extensions.

The second one is a [trusted-extensions repository](https://github.com/kaede-basement/trusted-extensions). I publish my extensions there. Others may publish there too, but only by contacting me. A plugin publisher must provide me the plugin source code and build manuals. I will manually review the provided code and provide the feedback if something is not good. The reviewing procedure will happen each time a plugin publisher wants to update their extension in the repository.

### Safety

Extensions can be loaded in two environments.

The first one is a restricted environment (sandbox) that uses a permission-based system. When enabling the plugin for the first time, the static permissions list will be shown. Static permissions are defined ahead-of-time. In case the plugin wants to extend its capabilities, it can use the `requestPermissions` function that returns a promise. `requestPermissions` is a plugin-scoped global variable that is essentially a reference to the function from another lexical environment, i.e. Kaede itself.

KAUR extensions are executed in this environment.

Restricted environment is achieved by using a [Secure ECMAScript](https://github.com/endojs/endo) framework. Each permission has its own list of globals passed to the plugin. Unfortunately, almost every DOM operation is prohibited since it leads to the sandbox escape.

The second one is an unrestricted environment that allows plugins to do everything that the Kaede can do itself. Trusted extensions are executed in this environment.

Settings have an option to enable the execution of KAUR extensions that require an unrestricted environment, because those extensions by default are prohibited.

## Making a Plugin

### TypeScript

The usage of TypeScript in Kaede plugins is possible via another [plugin](https://github.com/kaede-basement/trusted-extensions/tree/main/plugins/typescript-chan).

### Unrestricted

Top-level `await` is supported since the plugin code is executed via async function constructor.

Function constructors allow resulted code to execute in the same JavaScript engine context as of Kaede. Therefore, JIT compiler optimizations will also apply to plugins.

TO-DO explain:

- hook system (`window.__KAEDE__.hooks`)
- tauri api accessing
- tauri community plugins accessing
- possibility to monkey-patch literally every Kaede functionality
- a variety of Kaede helper functions
- other things that i do not remember rn

### Sandboxed

TO-DO explain:

- safe bidirectional events system (hooks alternative)
- make a list of permissions and their corresponding functionality grant
- performance
- Secure ECMAScript

## Making a Theme

Theming is possible via CSS. Themes should be files that end with the `.css` extension. Kaede will pick up one-level deep CSS files in the `themes` folder.

Every DOM element has a unique `id` attribute. In case the element is attached to a dynamic list (`<... v-for="..." />`), it will also have a unique class name.

The `id` attribute uses BEM methodology for naming.