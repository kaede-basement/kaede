import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, mock, spyOn, test } from "bun:test";

import { fetchDocument } from "./fetch-document.ts";
import { HttpBackend } from "./http-backend.ts";

test("documents preserve binary bytes, metadata and cancellation", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": { crypto } });
  try {
    const job = Promise.withResolvers<ArrayBuffer>();
    const ipc = mock((command: string) => (command === "fetch_http_document" ? job.promise : true));

    mockIPC(ipc);
    const abort = new AbortController;
    const fetch = fetchDocument("https://example.org", { "signal": abort.signal });

    abort.abort();
    const meta = {
      "status": 200, "headers": [["Content-Type", "image/png"]], "finalUrl": "https://cdn.test/",
    };
    const prefix = (new TextEncoder).encode(JSON.stringify(meta) + "\n");

    job.resolve(new Uint8Array([...prefix, 0, 10, 255]).buffer);
    await expect(fetch).rejects.toThrow();

    expect(ipc).toHaveBeenLastCalledWith("cancel_downloads", {
      "cancelId": expect.any(String),
    });
    const response = await fetchDocument("https://example.org");

    await fetchDocument("https://example.org/\uDC00", {
      "method": "POST", "body": "\uD83D😀\uDC00",
    });
    expect(ipc).toHaveBeenLastCalledWith("fetch_http_document", expect.objectContaining({
      "request": expect.objectContaining({
        "url": "https://example.org/\uFFFD", "body": "\uFFFD😀\uFFFD", "method": "POST",
      }),
    }));

    expect(response.url).toBe(meta.finalUrl);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(await response.bytes()).toEqual(new Uint8Array([0, 10, 255]));
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("browser preview fetches a document through the browser", async () => {
  using web = spyOn(globalThis, "fetch").mockResolvedValue(new Response("preview"));

  HttpBackend.current = "browser";
  try {
    const response = await fetchDocument("https://example.org");

    expect(await response.text()).toBe("preview");
    expect(web).toHaveBeenCalledTimes(1);
  } finally {
    HttpBackend.current = "tauri";
  }
});
