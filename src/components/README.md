[README for JavaScript-related code](../README.md)

# `components` folder

This folder contains only Vue components. All components use [Composition API](https://vuejs.org/guide/extras/composition-api-faq.html) with TypeScript.

Let me explain the file structure.

## Top-level folders

- `general` contains all **reusable** components that do not correspond to a specific page.
- `logging` contains all components that are used only in the log viewer screen.
- `add-instance` contains all components that are used only on the `Add Instance` page.
- `home` contains all components that are used only on the `Home` page.
- `library` contains all components that are used only on the `Library` page.
- `settings` contains all components that are used only on the `Settings` page.
- `profile` contains all components that are used only on the `Profile` page.

### `general` folder

- `base` contains all basic UI blocks with pre-defined styles and logic, such as buttons, inputs, sliders.

## Styles

### `z-index`

```
(development mode)
frames per second counter has 65000 z-index

(not development mode)
context menu             has 50000 z-index
sidebar hovering tooltip has 49000 z-index
log menu                 has 40000 z-index
sidebar                  has 10000 z-index
config sync loader icon  has 5000 z-index
global background        has -10 z-index
```
