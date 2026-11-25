import { mock } from "bun:test";
import { createRenderer, h, reactive } from "vue";
import { compileScript, parse } from "vue/compiler-sfc";

Bun.plugin({
  "name": "vue-component-setup",
  setup(build) {
    build.onLoad({ "filter": /\.vue$/ }, async ({ path }) => {
      const { descriptor } = parse(await Bun.file(path).text(), { "filename": path });

      return { "contents": compileScript(descriptor, { "id": path }).content, "loader": "ts" };
    });
  },
});

const noop = (): void => {};
const asyncNoop = async (): Promise<void> => {};

const authKey = Symbol();
const launchKey = Symbol();
const translationsKey = Symbol();

mock.module("@/constants/application.ts", () => ({
  "AuthStatesContextKey"  : authKey, "LaunchStatesContextKey": launchKey,
  "TranslationsContextKey": translationsKey, "CustomFontFamily"      : "test",
}));
const state = reactive({
  "selected": { "currentInstance": "first", "account": 0 },
  "ui"      : {
    "background": { "blur": null as number | null },
    "widget"    : { "blur": null as number | null }, "text"      : { "font": null },
  },
});

mock.module("@/states/global.ts", () => ({ "globalStates": state }));
mock.module("@/lib/instances", () => ({
  "default": { "findCurrent": (id: string): { "id": string } => ({ id }) },
}));
mock.module("@/states/instance.ts", () => ({
  "instanceStates": {},
}));
mock.module("@/lib/errors", () => ({ "default": { "prettify": String } }));

class Element extends EventTarget {
  play = mock(asyncNoop);
  pause = mock(noop);
}
const documentState = Object.assign((new EventTarget), {
  "hidden": true, "getElementById": (): null => null,
});

Object.assign(globalThis, {
  Element,
  "window"        : globalThis,
  "document"      : documentState,
  "ResizeObserver": class {
    observe(): void {}
    disconnect(): void {}
  },
});

// Mount real setup functions with just their template ref, without a browser or WebGL device.
const renderer = createRenderer<Element, Element>({
  "createElement" : () => (new Element), "createText"    : () => (new Element),
  "createComment" : () => (new Element), "insert"        : () => {}, "remove"        : () => {},
  "patchProp"     : () => {}, "setText"       : () => {}, "setElementText": () => {},
  "parentNode"    : () => null, "nextSibling"   : () => null,
});

type Mounted<T> = { "bindings": T; "unmount": () => void };
type Setup<T> = (properties: object, context: { "expose": () => void }) => T;

function mount<T>(
  component: unknown, templateReference: string, provides: Array<[symbol, unknown]> = [],
): Mounted<T> {
  let bindings: T;
  const app = renderer.createApp({
    setup() {
      bindings = (component as { "setup": Setup<T> }).setup({}, { "expose": () => {} });

      return (): ReturnType<typeof h> => h("div", { "ref": templateReference });
    },
  });

  for (const [key, value] of provides) {
    app.provide(key, value);
  }
  app.mount((new Element));

  return { "bindings": bindings!, "unmount": () => app.unmount() };
}

const invoke = mock(async (command: string, arguments_?: unknown): Promise<unknown> => {
  throw new Error(`Unexpected invocation: ${command} ${JSON.stringify(arguments_)}`);
});

mock.module("@tauri-apps/api/core", () => ({ invoke, "Channel": class {} }));

export {
  authKey, translationsKey, launchKey, mount, state, documentState, invoke,
  noop, asyncNoop,
};
export type { Element, Mounted };
