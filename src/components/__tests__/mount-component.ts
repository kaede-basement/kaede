import { readFileSync } from "node:fs";
import path from "node:path";

import { Window } from "happy-dom";
import { type App, type Component, createRenderer, h, nodeOps, patchProp } from "vue";
import { compileScript, parse } from "vue/compiler-sfc";

const compiled = (new Map<string, Component>);

async function component(name: string): Promise<Component> {
  const cached = compiled.get(name);

  if (cached) {
    return cached;
  }
  const filename = path.resolve("src/components", name + ".vue");
  const { descriptor } = parse(readFileSync(filename, "utf8"), { filename });
  const { content } = compileScript(descriptor, {
    "id"             : filename, "inlineTemplate" : true,
    "templateOptions": { "compilerOptions": { "hoistStatic": false } },
  });
  const specifier = "kaede-test:" + name;

  Bun.plugin({
    "name": specifier,
    setup(builder): void {
      builder.module(specifier, () => ({ "contents": content, "loader": "ts" }));
    },
  });
  const { "default": result } = await import(specifier);

  compiled.set(name, result);

  return result;
}

export async function mountComponent(
  name: string,
  properties: Record<string, unknown> = {},
  setup?: (app: App, document: Document) => void,
): Promise<Disposable & { "root": HTMLElement; "browser": Window }> {
  const browser = new Window({ "url": "http://localhost" });
  const document = browser.document as unknown as Document;
  const root = document.createElement("div");
  const target = await component(name);
  const renderer = createRenderer<Node, Element>({
    ...nodeOps,
    patchProp(element, key, previous, value): void {
      if (element.tagName === "TEST-CHILD") {
        Reflect.set(element, key, value);
      } else {
        patchProp(element, key, previous, value);
      }
    },
    createElement(tag): Element {
      // Bun imports nested .vue files as paths. Shallow-mount those children as custom elements.
      return document.createElement(tag.endsWith(".vue") ? "test-child" : tag);
    },
    "createComment": text => document.createComment(text),
    "createText"   : text => document.createTextNode(text),
  });
  const app = renderer.createApp({ "render": () => h(target, properties) });

  setup?.(app, document);
  document.body.append(root);
  app.mount(root);

  return {
    root, browser,
    [Symbol.dispose](): void {
      app.unmount();
      void browser.happyDOM.close();
    },
  };
}
