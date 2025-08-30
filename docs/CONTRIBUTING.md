# Contributions Guidelines

## Note

Thanks for your interest in contributing to Kaede!

## Translations

Translations are done externally via a [Kaede Translations repository](https://github.com/freesmteam/kaede-translations)

## Extensions

tbd

## Code Formatting

All files are formatted with [ESLint](https://eslint.org/) using the configuration in `eslint.config.js`. Ensure it is run on changed files before committing!

Please also follow the project's conventions for JavaScript:

- `.vue` file names should be formatted as `PascalCase`. All other files should use `kebab-case`.
- Exported constants should be formatted as `PascalCase`.
- Functions, variables, non-exported constants should be formatted as `camelCase`.
- Elements styling is preferred by using `Tailwind v3` classes. If there is no utility class for some case, make your own, or use CSS/JS.

## Commit Messages

### Format

`{type}({scope})!: {subject}`

### Elements

- **Type**: Choose from the following list. If none of the types match, use `chore`.
  - `feat`: A new feature
  - `fix`: A bug fix
  - `docs`: Documentation only changes
  - `style`: Changes that do not affect the meaning of the code
  - `refactor`: Improving code structure
  - `perf`: A code change that improves performance
  - `test`: Adding missing tests or correcting existing tests
  - `build`: Changes that affect the build system or external dependencies
  - `chore`: Other changes that don't modify src or test files
  - `revert`: Reverts a previous commit
  - `release`: Releasing a new version
  - `ci`: Changes to our CI configuration
- **Scope**: As described in Conventional Commits.
- **Breaking Change**: If you're introducing a breaking change, append `!` to the type or scope, e.g., `feat(ui)!: Breaking change`.

- **Subject**: Brief description of the change.

### Guidelines

- Use imperative mood, e.g., "add feature" instead of "adding feature" or "added feature".
- Avoid ending with a period.
