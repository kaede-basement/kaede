[README for TypeScript-related code](../src/README.md) | [README for Rust-related code](../src-tauri/README.md) | Contributing Guidelines

# Contributions Guidelines

## Note

Thanks for your interest in contributing to Kaede!

## Translations

Translations are done externally via a [Kaede Translations repository](https://github.com/freesmteam/kaede-translations)

## Extensions

You need this section only if you want to develop an extension.

### Repositories

Kaede has two built-in plugin repositories.

The first one is a [Kaede Add-ons User Repository (KAUR)](https://github.com/kaede-basement/kaur), similar to [AUR](https://aur.archlinux.org/) and [nixpkgs](https://github.com/NixOS/nixpkgs). This repository contains user published extensions.

The second one is a [trusted-extensions repository](https://github.com/kaede-basement/trusted-extensions). I publish my extensions there. Others may publish there too, but only by contacting me. A plugin publisher must provide me the plugin source code and build manuals. I will manually review the provided code and provide the feedback if something is not good. The reviewing procedure will happen each time a plugin publisher wants to update their extension in the repository.

### Safety

Extensions can be loaded in two environments.

The first one is a restricted environment (sandbox) that uses a permission-based system. When enabling the plugin for the first time, users are prompted with the permissions window. That window has permission toggles that the plugin requested. KAUR extensions are executed in this environment.

Restricted environment is achieved by using a [Secure ECMAScript](https://github.com/endojs/endo) framework. Each permission has its own list of globals that are passed to the plugin. Unfortunately, almost every DOM operation is prohibited since it leads to the sandbox escape.

The second one is an unrestricted environment that allows plugins to do everything that the Kaede can do itself. Trusted extensions are executed in this environment. Settings also have an option to enable the execution of KAUR extensions that require an unrestricted environment.

## Code Formatting

All files are formatted with [ESLint](https://eslint.org/) using the configuration in `eslint.config.js`. Ensure it is run on changed files before committing!

Please also follow the project's conventions for frontend:

- No AI slops in the launcher code (plugins don't count).
- TypeScript is highly recommended.
- `.vue` file names should be formatted as `PascalCase`. All other files should use `kebab-case`.
- Exported constants should be formatted as `PascalCase`.
- Functions, variables, non-exported constants should be formatted as `camelCase`.
- Element styling is preferred by using `Tailwind v3` classes. If there is no utility class for some cases, then make your own with CSS.
- [BEM](https://en.bem.info/methodology/) methodology is the preferred way to name element IDs and classes to simplify styling by extensions. All elements should have unique IDs.

## Commit Messages

### Format

`{type}({scope})!: {subject}`

### Elements

- **Type**: Choose from the following list. If none of the types match, use `chore`.
  - `feat`: A new feature.
  - `fix`: A bug fix.
  - `docs`: Documentation only changes.
  - `style`: Changes that do not affect the meaning of the code.
  - `refactor`: Improving code structure.
  - `perf`: A code change that improves performance.
  - `test`: Adding missing tests or correcting existing tests.
  - `build`: Changes that affect the build system or external dependencies.
  - `chore`: Other changes that don't modify src or test files.
  - `revert`: Reverts a previous commit.
  - `release`: Releasing a new version.
  - `ci`: Changes to our CI configuration.
- **Scope**: As described in Conventional Commits.
- **Breaking Change**: If you're introducing a breaking change, append `!` to the type or scope, e.g., `feat(ui)!: Breaking change`.

- **Subject**: Brief description of the change.

### Guidelines

- Use imperative mood, e.g. "add feature" instead of "adding feature" or "added feature".
- Avoid ending with a period.
