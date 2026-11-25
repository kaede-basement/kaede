import { readFileSync } from "node:fs";
import path from "node:path";

import { Window } from "happy-dom";
import { type App, type Component, createRenderer, h, nodeOps, patchProp } from "vue";
import { compileScript, parse } from "vue/compiler-sfc";

const compiled = (new Map<string, Component>);

async function component(name: string, nested: Array<string>): Promise<Component> {
  const cacheKey = [name, ...nested].join("+");
  const cached = compiled.get(cacheKey);

  if (cached) {
    return cached;
  }
  const filename = path.resolve("src/components", name + ".vue");
  const { descriptor } = parse(readFileSync(filename, "utf8"), { filename });
  const { content } = compileScript(descriptor, {
    "id"             : filename, "inlineTemplate" : true,
    "templateOptions": { "compilerOptions": { "hoistStatic": false } },
  });
  let contents = content;

  for (const child of nested) {
    await component(child, []);
    contents = contents.replace(`"@/components/${child}.vue"`, `"kaede-test:${child}"`);
  }
  const specifier = "kaede-test:" + cacheKey;

  Bun.plugin({
    "name": specifier,
    setup(builder): void {
      builder.module(specifier, () => ({ contents, "loader": "ts" }));
    },
  });
  const { "default": result } = await import(specifier);

  compiled.set(cacheKey, result);

  return result;
}

export async function mountComponent(
  name: string,
  properties: Record<string, unknown> = {},
  setup?: (app: App, document: Document) => void,
  nested: Array<string> = [],
): Promise<Disposable & { "root": HTMLElement; "browser": Window }> {
  const browser = new Window({ "url": "http://localhost" });
  const document = browser.document as unknown as Document;
  const root = document.createElement("div");
  const target = await component(name, nested);
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

export function pressEnter(view: Awaited<ReturnType<typeof mountComponent>>): void {
  const target = view.root.ownerDocument.activeElement as HTMLButtonElement;
  const event = new view.browser.KeyboardEvent("keydown", {
    "key": "Enter", "bubbles": true, "cancelable": true,
  });

  // Happy DOM leaves the native button default action to the caller.
  if (target.tagName === "BUTTON" && target.dispatchEvent(event as unknown as Event)) {
    target.click();
  }
}
