import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, mock, test } from "bun:test";
import { effectScope } from "vue";
import { createSSRApp } from "vue";
import { parse } from "vue/compiler-sfc";
import { renderToString } from "vue/server-renderer";

import { usePackSelection } from "./select-pack.ts";

test("selector sends metadata, cancels superseded work and reports errors", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": { crypto } });
  const scope = effectScope();

  try {
    const jobs = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
    let index = 0;
    const ipc = mock((command: string) => {
      if (command === "download_mrpack") return jobs[index++].promise;
    });

    mockIPC(ipc);
    const apply = mock();
    const selector = scope.run(() => usePackSelection(apply))!;
    const file = { "url"     : "pack", "filename": "pack.mrpack", "hashes"  : {
      "sha1": "a".repeat(40), "sha512": "a".repeat(128),
    }, "size": 100 };
    const primary = { ...file, "primary": true, "url": "primary" };

    await selector.select([file, file]);
    expect(selector.failure.value).toContain("one primary");
    const component = new URL(
      "../../components/add-instance/modrinth/ModpackVersionSelector.vue", import.meta.url,
    );
    const { descriptor } = parse(await Bun.file(component).text());
    const html = await renderToString(createSSRApp({
      "template": descriptor.template!.content,
      "setup"   : () => ({ ...selector, "data": [], "idRoot": "selector" }),
    }));

    expect(html).toContain("role=\"alert\"");
    expect(html).toContain(selector.failure.value);
    const first = selector.select([file, primary]);
    const firstId = selector.pending.value;

    expect(ipc).toHaveBeenCalledWith("download_mrpack", {
      "cancelId": firstId, "file": { "url": "primary", "size": file.size, "hashes": file.hashes },
    });
    const second = selector.select([file]);

    expect(ipc).toHaveBeenCalledWith("cancel_downloads", { "cancelId": firstId });
    const secondId = selector.pending.value;

    jobs[0].resolve();
    await first;
    expect(apply).not.toHaveBeenCalled();
    scope.stop();
    expect(ipc).toHaveBeenCalledWith("cancel_downloads", { "cancelId": secondId });
    jobs[1].reject(new Error("cancelled"));
    await second;
    expect(selector.failure.value).toBe("");
  } finally {
    scope.stop();
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
