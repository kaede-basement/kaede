import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, mock, test } from "bun:test";

import { handleInternetPermission } from "./internet.ts";

test("scoped extensions receive completed redirect and error responses", async () => {
  const previous = ["window", "harden"]
    .map(key => Object.getOwnPropertyDescriptor(globalThis, key));

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": { crypto } });
  Object.defineProperty(globalThis, "harden", { "configurable": true, "value": Object.freeze });
  try {
    const url = "https://example.org/scoped";
    let status = 204;
    const bodyError = "interrupted error body";
    const ipc = mock((cmd: string) => {
      if (cmd !== "fetch_http_document") throw new Error(cmd);
      const meta = { status, "bodyError": status === 404 ? bodyError : undefined,
        "finalUrl" : url, "headers"  : [] };

      return (new TextEncoder).encode(JSON.stringify(meta) + "\n").buffer;
    });

    mockIPC(ipc);
    const grant = handleInternetPermission({
      "scope": "http-get", "id": "test", "argument": url,
    }) as {
      "tauriFetch": (url: string) => Promise<Response>;
    };

    for (status of [204, 205, 304, 302, 503]) {
      ipc.mockClear();
      const response = await grant.tauriFetch(url);

      expect(response.status).toBe(status);
      expect(ipc).toHaveBeenCalledTimes(1);
      expect(ipc).toHaveBeenCalledWith("fetch_http_document", {
        "cancelId": null,
        "request" : expect.objectContaining({ "followRedirects": false, url }),
      });
    }
    status = 404;
    const interrupted = await grant.tauriFetch(url);

    expect(interrupted.status).toBe(404);
    await expect(interrupted.text()).rejects.toThrow(bodyError);

    const post = handleInternetPermission({
      "id": "test", "scope": "http-post", "argument": url,
    }) as {
      "tauriFetch": (url: string, body: Uint8Array, contentType: string) => Promise<Response>;
    };

    mockIPC((cmd, payload) => {
      expect(cmd).toBe("fetch_http_document");
      if (!(payload instanceof Uint8Array)) throw new Error("Expected binary IPC");
      const end = payload.indexOf(10);
      const { request } = JSON.parse((new TextDecoder).decode(payload.subarray(0, end)));

      expect(request).toMatchObject({ "method": "POST", "followRedirects": false, url });
      expect([...payload.subarray(end + 1)]).toEqual([0, 255]);

      const meta = { "status": 204, "finalUrl": url };

      return (new TextEncoder).encode(JSON.stringify(meta) + "\n").buffer;
    });
    await post.tauriFetch(url, new Uint8Array([1, 0, 255]).subarray(1), "image/png");
    mockIPC(ipc);
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
