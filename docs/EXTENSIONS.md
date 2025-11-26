### Repositories

Kaede has two built-in plugin repositories.

The first one is a [Kaede Add-ons User Repository (KAUR)](https://github.com/kaede-basement/kaur), similar to [AUR](https://aur.archlinux.org/) and [nixpkgs](https://github.com/NixOS/nixpkgs). This repository contains user published extensions.

The second one is a [trusted-extensions repository](https://github.com/kaede-basement/trusted-extensions). I publish my extensions there. Others may publish there too, but only by contacting me. A plugin publisher must provide me the plugin source code and build manuals. I will manually review the provided code and provide the feedback if something is not good. The reviewing procedure will happen each time a plugin publisher wants to update their extension in the repository.

### Safety

Extensions can be loaded in two environments.

The first one is a restricted environment (sandbox) that uses a permission-based system. When enabling the plugin for the first time, users are prompted with the permissions window. That window has permission toggles that the plugin requested. KAUR extensions are executed in this environment.

Restricted environment is achieved by using a [Secure ECMAScript](https://github.com/endojs/endo) framework. Each permission has its own list of globals that are passed to the plugin. Unfortunately, almost every DOM operation is prohibited since it leads to the sandbox escape.

The second one is an unrestricted environment that allows plugins to do everything that the Kaede can do itself. Trusted extensions are executed in this environment. Settings also have an option to enable the execution of KAUR extensions that require an unrestricted environment.

## Making a Plugin

## Making a Theme