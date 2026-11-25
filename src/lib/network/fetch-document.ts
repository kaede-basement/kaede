import { invoke } from "@tauri-apps/api/core";

import { log } from "@/lib/logging/log.ts";

import { HttpBackend } from "./http-backend.ts";

type Metadata = {
  "status"    : number;
  "statusText": string;
  "headers"   : Array<[string, string]>;
  "finalUrl"  : string;
};

export async function fetchDocument(url: string, init?: {
  "method"? : string;
  "headers"?: HeadersInit;
  "body"?   : string;
  "signal"? : AbortSignal;
}): Promise<Response> {
  if (HttpBackend.current === "browser") {
    return globalThis.fetch(url, {
      ...init, "redirect": init?.method === "POST" ? "manual" : "follow",
    });
  }
  if (HttpBackend.current === "wails") {
    const { fetch } = await import("@tauri-apps/plugin-http");

    return fetch(url, { ...init, "maxRedirections": init?.method === "POST" ? 0 : undefined });
  }
  const signal = init?.signal;

  signal?.throwIfAborted();
  const cancelId = signal ? crypto.randomUUID() : null;
  const abort = (): void => {
    void invoke("cancel_downloads", { cancelId }).catch(() => {
      log.warn(__PRE_BUNDLED_FILENAME__, "HTTP cancellation could not reach the backend");
    });
  };

  signal?.addEventListener("abort", abort, { "once": true });
  try {
    const result = await invoke<ArrayBuffer>("fetch_http_document", {
      cancelId,
      "request": {
        url,
        "method" : init?.method ?? "GET",
        "headers": [...new Headers(init?.headers)],
        "body"   : init?.body,
      },
    });

    signal?.throwIfAborted();
    const bytes = new Uint8Array(result);
    const end = bytes.indexOf(10);

    if (end === -1) throw new Error("Incomplete HTTP document");
    const meta: Metadata = JSON.parse((new TextDecoder).decode(bytes.subarray(0, end)));
    const body = [204, 205, 304].includes(meta.status) || init?.method === "HEAD"
      ? null : bytes.subarray(end + 1);
    const response = new Response(body, meta);

    Object.defineProperty(response, "url", { "value": meta.finalUrl });

    return response;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
