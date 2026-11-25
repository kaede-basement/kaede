import { mock } from "bun:test";
import { createRenderer, h, reactive, shallowReactive } from "vue";
import { compileScript, parse } from "vue/compiler-sfc";

import { LaunchStatus } from "@/constants/launcher.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

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
const startKey = Symbol();
const closeKey = Symbol();

mock.module("@/constants/application.ts", () => ({
  "LaunchInstanceContextKey"        : startKey, "CloseInstanceContextKey"         : closeKey,
  "LaunchInstanceStatusesContextKey": Symbol(),
  "AuthStatesContextKey"            : authKey, "LaunchStatesContextKey"          : launchKey,
  "TranslationsContextKey"          : translationsKey, "CustomFontFamily"                : "test",
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
const instances = reactive<Record<string, { "playTime": number }>>({});

mock.module("@/states/instance.ts", () => ({
  "instanceStates": instances,
}));
mock.module("@/lib/errors", () => ({ "default": { "prettify": String } }));

class Element extends EventTarget {
  parentElement?: Element;
  play = mock(asyncNoop);
  pause = mock(noop);
}
const documentState = Object.assign((new EventTarget), {
  "body"          : { "style": { "cursor": "" } },
  "hidden"        : false, "getElementById": (): null => null,
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
  "createElement": () => (new Element), "createText"   : () => (new Element),
  "createComment": () => (new Element), "insert"       : (child, parent) => {
    child.parentElement = parent;
  }, "remove"        : () => {},
  "patchProp"     : () => {}, "setText"       : () => {}, "setElementText": () => {},
  "parentNode"    : () => null, "nextSibling"   : () => null,
});

type Mounted<T> = { "bindings": T; "unmount": () => void };
type Setup<T> = (properties: object, context: { "expose": () => void }) => T;

const mounted = new Set<() => void>;
const globalsToRestore = new Map<string, PropertyDescriptor | undefined>;

function overrideGlobals(values: Record<string, unknown>): void {
  for (const name of Object.keys(values)) {
    if (!globalsToRestore.has(name)) {
      globalsToRestore.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    }
  }
  Object.assign(globalThis, values);
}

function cleanupHarness(): void {
  for (const unmount of mounted) {
    unmount();
  }
  mock.restore();
  for (const [name, descriptor] of globalsToRestore) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  }
  globalsToRestore.clear();
}

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
  function unmount(): void {
    if (mounted.delete(unmount)) {
      app.unmount();
    }
  }
  mounted.add(unmount);
  app.mount((new Element));

  return { "bindings": bindings!, unmount };
}

function launchStatus(instanceId: string): LauncherStatusesType {
  const current = shallowReactive(new Map<string, [number, number]>);

  return {
    instanceId, "launching": 1, "current"  : LaunchStatus.General.Starting,
    "downloads": { current, "success": 0, "failed": 0, "total": 0 },
  };
}

const invoke = mock(async (command: string, arguments_?: unknown): Promise<unknown> => {
  throw new Error(`Unexpected invocation: ${command} ${JSON.stringify(arguments_)}`);
});

mock.module("@tauri-apps/api/core", () => ({ invoke, "Channel": class {} }));

export {
  authKey, translationsKey, launchKey, startKey, closeKey, instances, mount, state,
  documentState, invoke, noop, asyncNoop, overrideGlobals, cleanupHarness, launchStatus,
};
export type { Element, Mounted };
