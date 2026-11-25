import { getEventListeners } from "node:events";

import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { expect, test } from "bun:test";

import { fetchForExtension, handleInternetPermission } from "./atomic/internet.ts";

test("finished Tauri responses detach the activation abort listener", async () => {
  const lifetime = new AbortController;
  const url = new URL("https://example.test");
  const scope = { "id": "test", "scope": "http-get", "argument": url } as const;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": {} });
  let abortAtHeaders = false;
  let cancelledBodies = 0;
  let streaming = false;

  mockIPC(command => {
    switch (command) {
      case "plugin:http|fetch": { return 1; }
      case "plugin:http|fetch_send": {
        if (abortAtHeaders) lifetime.abort();

        return { "rid": 2, "status": 200, "statusText": "OK", "url": url.href, "headers": [] };
      }
      case "plugin:http|fetch_cancel": { return; }
      case "plugin:http|fetch_cancel_body": {
        cancelledBodies++;
        break;
      }
      case "plugin:http|fetch_read_body": {
        return new Uint8Array(streaming ? [42, 0] : [1]).buffer;
      }
      default: { throw new Error(command); }
    }
  });
  try {
    const response = await fetchForExtension(
      scope, "tauriFetch", url.href, undefined, undefined, lifetime.signal,
    );

    await response.arrayBuffer();
    expect(getEventListeners(lifetime.signal, "abort")).toHaveLength(0);

    streaming = true;
    const { tauriFetch } = handleInternetPermission(scope, lifetime.signal) as {
      tauriFetch(url: string): Promise<{ "status": number }>;
    };

    expect(await tauriFetch(url.href).then(result => result.status)).toBe(200);
    expect(getEventListeners(lifetime.signal, "abort")).toHaveLength(1);
    await Bun.sleep(0);
    Bun.gc(true);
    await Bun.sleep(0);
    expect(getEventListeners(lifetime.signal, "abort")).toHaveLength(0);
    expect(cancelledBodies).toBe(1);

    abortAtHeaders = true;
    await expect(fetchForExtension(
      scope, "tauriFetch", url.href, undefined, undefined, lifetime.signal,
    )).rejects.toThrow();
    expect(cancelledBodies).toBe(2);
    expect(getEventListeners(lifetime.signal, "abort")).toHaveLength(0);
  } finally {
    clearMocks();
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
