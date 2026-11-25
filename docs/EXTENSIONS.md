# Extensions

## General

### Introduction

Kaede extensions are pieces of JavaScript code that change the User Interface (UI) or functionality of a launcher. They are loaded at runtime and are not included by default. Extensions can be written by anyone.

> [!NOTE]
> The documentation will use terms "add-on", "plugin", and "extension" interchangeably.

### Format

Plugins are stored in the `extensions` folder and represent [ZIP](https://en.wikipedia.org/wiki/ZIP_(file_format)) archive files that use [DEFLATE](https://en.wikipedia.org/wiki/Deflate) compression. They can have either `.zip` or `.kaede` file extension. Every plugin archive should have two files: (1) `index.js` and (2) `metadata.json`. The `index.js` file is the code that will be executed, and `metadata.json` is a plugin metadata that has the following type.

> [!NOTE]
> Kaede remembers which plugins the user enabled by a SHA256 hash of both `metadata.json` and `index.js`. Even if the ID of a plugin stays the same, changing either file disables the plugin and asks for its permissions again. The trusted-extensions check uses the hash of `index.js` alone.

```ts
type MetadataType = {
  "logo"      : string;
  "name"      : string;
  "type"      : "sandbox" | "unrestricted";
  "source"    : string;
  "version"   : string;
  "authors"   : Array<string>;
  // Use ISO 639-1 two-letter language codes
  "languages" : Array<string>;
  "categories": Array<string>;
} & Partial<{
  "description": string;
  "permissions": Array<PermissionType>;
  "enabled"    : boolean;
}>;
```

An example of a valid metadata:

```json
{
  "logo": "",
  "name": "Better UI reload",
  "source": "",
  "version": "",
  "authors": ["notwindstone"],
  "languages": [],
  "categories": [],
  "type": "unrestricted"
}
```

Please note that the file name of a ZIP archive file acts as a plugin ID.

### Repositories

Plugin repository is a place that stores and distributes plugins. Additional repositories can be added although Kaede has two built-in plugin repositories.

The first one is a [Kaede User Repository (KUR)](https://github.com/kaede-basement/kur), similar to [Arch User Repository (AUR)](https://aur.archlinux.org/) and [nixpkgs](https://github.com/NixOS/nixpkgs). KUR contains user published extensions.

The second one is a [trusted-extensions repository](https://github.com/kaede-basement/trusted-extensions) where I publish my extensions. Others may publish as well but only by contacting me. A plugin publisher must provide me the plugin source code and build manuals. I will manually review the provided code and provide the feedback if something seems fishy. The reviewing procedure will happen each time a plugin publisher wants to update their extension in the repository.

### Safety

Balancing between the safety, performance, and developer experience (DX) of plugins is hard, especially since I am the only developer of this project. Surely, various approaches to ensure the security of user plugins exist:

- embedding user components via `<iframe />`;
- using Web Workers for an arbitrary code;
- running another JavaScript engine (either in WebAssembly or JavaScript itself) to execute the code;
- [ShadowRealm (continuation of realms-shim)](https://tc39.es/proposal-shadowrealm/);
- executing JS plugins in another WebView window spawned by Tauri with no permissions.

An extension declares its type in its metadata. For a sandboxed extension, **Settings → Extensions → Run sandboxed extensions in Web Workers** selects the execution engine. SES is the default. Switching the setting restarts enabled sandboxed extensions. Both engines use the same archive and artifact-scoped permission decisions. If a saved Worker selection is unavailable at startup, the launcher restores enabled extensions in SES.

| | Unrestricted | Sandboxed · SES | Sandboxed · Web Worker |
| --- | --- | --- | --- |
| Authority | Runs with launcher privileges, including access to accounts and files. | A locked-down Compartment receives the capabilities approved for the artifact. | A locked-down Compartment in a dedicated Worker receives the same capabilities. The launcher checks grants and executes privileged requests. |
| UI | Direct access to the launcher DOM. | Kaede’s patched Ark 0.3.1 exposes a synchronous UI in a host-owned frame at the bottom of the launcher. Root IDs such as `app` name private extension roots. | Ark operations cross the thread boundary in batches. Root lookup, styles and listeners stay inside the extension frame. Plugin computation runs off the UI thread. DOM commits still use it. |
| Reads and events | Native browser values and event dispatch. | Synchronous browser-normalized values and native event cancellation through Ark. | Synchronous reads return Worker-local submitted values. Input events refresh form values from the host. Event handlers receive snapshots. Use declarative listener options to cancel during dispatch. |
| Create 10,000 divs · commit | 3.8 / 3.9 ms | 14.5 / 16.8 ms | 39.2 / 45.9 ms |
| Create 10,000 divs · frame-settled | 34.1 / 41.6 ms | 49.2 / 55.1 ms | 94.5 / 99.6 ms |
| Edit 500 rows · commit | 0.5 / 0.8 ms | 1.1 / 1.2 ms | 3.6 / 4.2 ms |
| Edit 500 rows · frame-settled | 25.0 / 26.8 ms | 24.8 / 28.9 ms | 19.3 / 31.0 ms |
| Focused input to text update · commit | 0.0 / 0.1 ms | 0.1 / 0.2 ms | 2.3 / 2.8 ms |
| Focused input to text update · frame-settled | 32.6 / 32.9 ms | 32.5 / 32.8 ms | 32.5 / 32.8 ms |
| Mount, create 1,000 divs, remove and dispose · commit | 2.0 / 2.2 ms | 4.0 / 4.4 ms | 20.4 / 21.3 ms |
| Mount, create 1,000 divs, remove and dispose · frame-settled | 21.5 / 22.1 ms | 16.5 / 18.0 ms | 46.2 / 47.4 ms |
| Renderer JS heap delta after lifecycle and GC | +0.04 / +0.04 KiB | -224.04 / -221.38 KiB | -224.06 / -223.05 KiB |

The launcher presents static permissions when the user enables the extension. A plugin can request additional capabilities with `await requestPermissions([...])`. A Worker can wait for a permission decision during startup or activation. Teardown has a separate 10-second deadline, including permission waits. In SES, the launcher can cancel its wait for an asynchronous hook and revoke the activation’s capabilities once the event loop can run. A synchronous loop in an SES hook blocks the launcher and its timeout. In Worker mode the launcher runs the timeout on its own thread and can terminate a Worker even while the hook loops. Disabling either sandbox removes its UI.

In Worker mode, register cancellation before dispatch, for example with `button.addEventListener("click", handler, { preventDefault: true, stopPropagation: true })`. The same options accept `stopImmediatePropagation` to suppress later listeners on the target. The public `SandboxUIDocument` type includes this listener signature. Calling `event.preventDefault()`, `stopPropagation()`, or `stopImmediatePropagation()` inside the Worker callback throws because native dispatch has finished. Use SES for conditional native cancellation or immediate browser-normalized reads such as CSS serialization. Worker mutations are asynchronous, and serializing operations and committing them in the launcher adds overhead.

### Benchmark methodology

Run `bun scripts/sandbox-browser/run.ts` with Chrome or Chromium available. The harness builds the production sandbox runners with Vite and serves the resulting assets to headless Chrome. The table gives **median / nearest-rank p95** from 20 samples per mode after one warm-up, rotating execution order. All three render in equally sized frames. Each workload has two timings from the same start. **Commit** ends when the host has applied the DOM change. **Frame-settled** ends after two subsequent animation-frame callbacks, which includes waiting for a rendering opportunity. Verification runs outside both reported times.

Creation sets text and class on each div. The sparse update changes text, a data attribute and color on every twentieth row. Both end with one marker attribute write on the container. A MutationObserver watching only that attribute timestamps its delivery on the host. For focused input, the observer watches the row whose text the handler changes and timing starts at event dispatch. The zero median for direct input means the start and observer callback fell within the same browser timer tick.

Lifecycle timing starts with a prepared artifact, includes sandbox startup, and ends at frame removal after creating and removing the 1,000-row subtree. Both times exclude the interval spent checking the row count and each row’s initial text before removal. Its frame-settled time adds two callbacks after disposal. The Unrestricted column is a direct-DOM baseline that creates and removes the same UI without running the launcher’s unrestricted extension loader.

The heap row measures the renderer isolate through Chrome DevTools Protocol before and after the lifecycle sample, with forced garbage collection on each side. Negative deltas can include collection of prior frames. Worker-isolate memory and native DOM storage are outside this measurement.

Measured on NixOS, Chrome 158.0.8127.36, AMD Ryzen 9 9950X (32 logical CPUs). Load averages before the run were 1.43 / 0.92 / 0.84. The Windows VM used 8.1 GiB and 6.9% CPU in the cgroup sample.

In a separate 350-cycle Worker run, Chrome reported one harness document, eight harness nodes and zero JS event listeners after collection at every 50-cycle checkpoint. Renderer JS heap usage at cycles 250, 300 and 350 was 1.41, 1.36 and 1.42 MiB. The run began at load averages of 1.51 / 0.99 / 0.87 with the same VM using 8.1 GiB and 7.1% CPU.

## Making a Plugin

### TypeScript

The usage of TypeScript in Kaede plugins is possible via another [plugin](https://github.com/kaede-basement/trusted-extensions/tree/main/plugins/typescript-chan).

### Unrestricted

A top-level `await` is supported since the plugin code is executed via an async function constructor:

```ts
const AsyncFunction = async function (): Promise<void> {}.constructor as FunctionConstructor;
```

Function constructors allow a dynamic creation of functions with arbitrary code within the same JavaScript engine context as of Kaede. Therefore, JIT compiler optimizations are also applicable to plugins.

For further details about this environment, expand the next section.

Getting deeper >>>

<details>

### Hook System

A hook system in Kaede is a powerful technique that allows plugins to intercept functions. 

### Tauri API

- hook system (`window.__KAEDE__.hooks`)
- tauri api accessing
- tauri community plugins accessing
- possibility to monkey-patch literally every Kaede functionality
- a variety of Kaede helper functions
- other things that i do not remember rn

</details>

### Sandboxed

For further details about this environment, expand the next section.

The unexplored isolation >>>

<details>

TO-DO explain:

- safe bidirectional events system (hooks alternative)
- make a list of permissions and their corresponding functionality grant
- performance
- Secure ECMAScript

</details>

## Making a Theme

Theming is possible via CSS. Themes should represent files that end with the `.css` extension. Kaede will pick up one-level deep CSS files in the `themes` folder.

Every DOM element has a unique `id` attribute. In case the element is attached to a dynamic list (`<... v-for="..." />`), it will also have a unique class name.

The `id` attribute uses BEM methodology for naming.
