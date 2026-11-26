import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, mock, spyOn, test } from "bun:test";
import { effectScope } from "vue";
import { createSSRApp } from "vue";
import { parse } from "vue/compiler-sfc";
import { renderToString } from "vue/server-renderer";

import { HttpBackend } from "@/lib/network/http-backend.ts";

import { usePackSelection } from "./select-pack.ts";

test("selector sends metadata, cancels superseded work and reports errors", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": { crypto } });
  const scope = effectScope();
  const randomUUID = Object.getOwnPropertyDescriptor(crypto, "randomUUID");

  Object.defineProperty(crypto, "randomUUID", { "configurable": true, "value": undefined });

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

    await selector.select([]);
    expect(selector.failure.value).toContain("no .mrpack");
    const notes = { ...file, "filename": "00-notes.txt" };

    await selector.select([notes, file]);
    expect(selector.failure.value).toContain("primary file must be a .mrpack");
    await selector.select([file, { ...notes, "primary": true }]);
    expect(selector.failure.value).toContain("primary file must be a .mrpack");
    expect(ipc).not.toHaveBeenCalled();
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
    const second = selector.select([file, { ...file, "url": "alternative" }]);

    expect(ipc).toHaveBeenCalledWith("cancel_downloads", { "cancelId": firstId });
    const secondId = selector.pending.value;

    expect(ipc).toHaveBeenCalledWith("download_mrpack", {
      "cancelId": secondId, "file": { "url": file.url, "size": file.size, "hashes": file.hashes },
    });
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
    if (randomUUID) Object.defineProperty(crypto, "randomUUID", randomUUID);
    else Reflect.deleteProperty(crypto, "randomUUID");
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("preview selector normalizes legacy peek_mrpack without state bootstrap", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldBackend = HttpBackend.current;
  const payload = new Uint8Array([80, 75, 5, 6]);
  const sha1 = [...new Uint8Array(await crypto.subtle.digest("SHA-1", payload))]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
  const sha512 = [...new Uint8Array(await crypto.subtle.digest("SHA-512", payload))]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
  const base = {
    "formatVersion": 1,
    "name"         : "Browser Pack",
    "versionId"    : "1.0.0",
    "summary"      : null,
    "dependencies" : { "minecraft": "1.21.1" },
    "overrides"    : 1,
  };
  const scope = effectScope();
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    (async () => new Response(payload, { "status": 200 })) as unknown as typeof fetch,
  );

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": { crypto } });
  HttpBackend.current = "browser";

  try {
    mockIPC(command => {
      if (command === "peek_mrpack") {
        return { ...base, "files": [{ "path": "mods/a.jar" }, { "path": "mods/b.jar" }] };
      }
      if (command === "plugin:fs|exists") return false;

      return null;
    });

    const received: Array<unknown> = [];
    const selector = scope.run(() => usePackSelection(pack => {
      received.push(pack);
    }))!;

    await selector.select([{
      "url"     : "https://cdn.modrinth.com/pack.mrpack",
      "filename": "pack.mrpack",
      "hashes"  : { sha1, sha512 },
      "size"    : payload.byteLength,
      "primary" : true,
    }]);

    expect(selector.failure.value).toBe("");
    expect(received).toHaveLength(1);
    const pack = received[0] as { "manifest": Record<string, unknown>; "path": string };

    expect(pack.manifest).toEqual({ ...base, "fileCount": 2 });
    expect("files" in pack.manifest).toBe(false);
    expect(pack.path).toContain(`${sha512}.mrpack`);
  } finally {
    scope.stop();
    fetchSpy.mockRestore();
    HttpBackend.current = oldBackend;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
