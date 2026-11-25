import { useQueryClient } from "@tanstack/vue-query";
import { expect, test } from "bun:test";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";

import { GlobalInternals } from "@/extendable/global-internals.ts";

// Only the page boundary matters here. Run real async components and Vue Query injection.
Bun.plugin({
  "name": "page-query-consumers",
  setup(build) {
    build.onLoad({ "filter": /\.vue$/u }, ({ path }) => ({
      "contents": (/[/\\](?:AddInstance|ExtensionLoader)\.vue$/u).test(path)
        ? `import {useQueryClient} from "@tanstack/vue-query";
           export default {setup(){useQueryClient();return () => "ready"}}`
        : "export default {}",
      "loader": "js",
    }));
  },
});

test("register, override and restore each page before loading its implementation", async () => {
  const { registerComponents } = await import("./register-components.ts");
  const { C, LazyExtensionLoader, __registerComponent, __restoreComponent } =
    await import("@/extendable/component-registry.ts");

  registerComponents();
  for (const name of ["Library", "Settings", "AddInstance", "Profile"]) {
    const original = C[name];
    const replacement = {};

    expect("__asyncLoader" in original).toBe(true);
    __registerComponent(name, replacement);
    expect(C[name]).toBe(replacement);
    expect(__restoreComponent(name)).toBe(true);
    expect(C[name]).toBe(original);
  }

  for (const consumer of [C.AddInstance, LazyExtensionLoader]) {
    const app = createSSRApp({ "render": () => h(consumer) });

    GlobalInternals.appInstance = app;
    expect(await renderToString(app)).toContain("ready");
    expect(app.runWithContext(useQueryClient)).toBeDefined();
  }
});
