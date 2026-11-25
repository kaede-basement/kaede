import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, mock, test } from "bun:test";
import { createRenderer, nextTick, ref } from "vue";
import { compileScript, parse } from "vue/compiler-sfc";

import { TranslationsContextKey } from "@/constants/application.ts";
import English from "@/constants/english.json";

import { withTestWindow } from "../../../scripts/setup-tests.ts";

Bun.plugin({
  "name": "clear-cache-component",
  setup(build): void {
    build.onLoad({ "filter": /\/MinecraftCacheAction\.vue$/ }, async ({ path }) => {
      const source = await Bun.file(path).text();
      const { descriptor } = parse(source, { "filename": path });
      const options = { "id": "clear-cache", "inlineTemplate": true };
      const { content } = compileScript(descriptor, options);

      return { "contents": content, "loader": "ts" };
    });
  },
});

test("cache action feedback and duplicate clicks", () => withTestWindow(async () => {
  const { "default": component } = await import("./MinecraftCacheAction.vue");

  type Element = { "text"?: string; "onClick"?: () => Promise<void>; "disabled"?: boolean };
  const elements = new Map<string, Element>;
  const nodes: Array<Element> = [];
  const renderer = createRenderer<Element, Element>({
    createElement(tag) {
      const element = {};

      elements.set(tag, element);

      return element;
    },
    "createComment": () => ({}), "createText": () => ({}), insert(element, _, anchor) {
      const position = anchor ? nodes.indexOf(anchor) : -1;

      nodes.splice(position === -1 ? nodes.length : position, 0, element);
    },
    "nextSibling": element => nodes[nodes.indexOf(element) + 1] ?? null,
    "parentNode" : () => null,
    "remove"     : element => {
      nodes.splice(nodes.indexOf(element), 1);
    },
    "setElementText": (element, text) => {
      element.text = text;
    }, "setText"  : () => {},
    "patchProp": (element, key, _, value) => {
      Reflect.set(element, key, value);
    },
  });
  const result = Promise.withResolvers<void>();
  const command = mock(async (name: string) => {
    expect(name).toBe("clear_mod_cache");

    return result.promise;
  });

  mockIPC(command);
  const app = renderer.createApp(component);

  app.provide(TranslationsContextKey, ref(English));
  app.mount({});
  try {
    const button = elements.get("button")!;
    const status = elements.get("span")!;
    const clearing = button.onClick!();

    await nextTick();
    expect(button.disabled).toBe(true);
    await button.onClick!();
    expect(command).toHaveBeenCalledTimes(1);
    result.resolve();
    await clearing;
    expect(status.text).toBe("Mod cache cleared.");
    command.mockRejectedValueOnce(new Error("disk busy"));
    await button.onClick!();
    expect(button.disabled).toBe(false);
    expect(status.text).toContain("disk busy");
  } finally {
    app.unmount();
  }
}));
