import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, mock, test } from "bun:test";

import { handleInternetPermission } from "./internet.ts";

test("extensions disable redirects and release null-body responses", async () => {
  const previous = ["window", "harden"]
    .map(key => Object.getOwnPropertyDescriptor(globalThis, key));

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": { crypto } });
  Object.defineProperty(globalThis, "harden", { "configurable": true, "value": Object.freeze });
  try {
    const url = "https://example.org/scoped";
    let status = 204;
    const ipc = mock((cmd: string) => {
      if (cmd === "plugin:http|fetch") return 1;
      if (cmd === "plugin:http|fetch_send") return { status, url, "headers": [], "rid": 2 };
      if (cmd !== "plugin:http|fetch_cancel_body") throw new Error(cmd);
    });

    mockIPC(ipc);
    const grant = handleInternetPermission({
      "scope": "http-get", "id": "test", "argument": url,
    }) as {
      "tauriFetch": (url: string) => Promise<Response>;
    };

    for (status of [204, 205, 304]) {
      ipc.mockClear();
      const response = await grant.tauriFetch(url);

      expect(response.status).toBe(status);
      expect(await response.text()).toBe("");
      expect(ipc).toHaveBeenCalledWith("plugin:http|fetch", {
        "clientConfig": expect.objectContaining({ "maxRedirections": 0, url }),
      });
      expect(ipc).toHaveBeenLastCalledWith("plugin:http|fetch_cancel_body", { "rid": 2 });
    }
    ipc.mockClear();
    await expect(grant.tauriFetch(url + "-outside")).rejects.toThrow("scope");
    expect(ipc).not.toHaveBeenCalled();
  } finally {
    for (const [index, key] of ["window", "harden"].entries()) {
      const descriptor = previous[index];

      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
