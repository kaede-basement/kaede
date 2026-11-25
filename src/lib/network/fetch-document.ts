import { invoke } from "@tauri-apps/api/core";

import { log } from "@/lib/logging/log.ts";

import { createRequestId } from "./create-request-id.ts";
import { HttpBackend } from "./http-backend.ts";

type Metadata = {
  "status"    : number;
  "statusText": string;
  "headers"   : Array<[string, string]>;
  "finalUrl"  : string;
};

export async function fetchDocument(url: string, init?: {
  "method"?         : string;
  "headers"?        : HeadersInit;
  "body"?           : string | ArrayBuffer | Uint8Array;
  "followRedirects"?: boolean;
  "signal"?         : AbortSignal;
}): Promise<Response> {
  const followRedirects = init?.method !== "POST" && (init?.followRedirects ?? true);

  if (HttpBackend.current !== "tauri") {
    const options: RequestInit = {
      "method"  : init?.method,
      "headers" : init?.headers,
      "body"    : init?.body as BodyInit | undefined,
      "signal"  : init?.signal,
      "redirect": followRedirects ? "follow" : "manual",
    };

    if (HttpBackend.current === "browser") return globalThis.fetch(url, options);
    const { fetch } = await import("@tauri-apps/plugin-http");

    return fetch(url, { ...options, "maxRedirections": followRedirects ? undefined : 0 });
  }
  const signal = init?.signal;

  signal?.throwIfAborted();
  const cancelId = signal ? createRequestId() : null;
  const abort = (): void => {
    void invoke("cancel_downloads", { cancelId }).catch(() => {
      log.warn(__PRE_BUNDLED_FILENAME__, "HTTP cancellation could not reach the backend");
    });
  };

  signal?.addEventListener("abort", abort, { "once": true });
  try {
    const body = init?.body;
    const envelope = {
      cancelId,
      "request": {
        url, followRedirects,
        "method" : init?.method ?? "GET",
        "headers": [...new Headers(init?.headers)],
        "body"   : typeof body === "string" ? body : undefined,
      },
    };
    let payload: typeof envelope | Uint8Array = envelope;

    if (body !== undefined && typeof body !== "string") {
      const bytes = ArrayBuffer.isView(body)
        ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength) : new Uint8Array(body);
      const prefix = (new TextEncoder).encode(JSON.stringify(envelope) + "\n");

      payload = new Uint8Array(prefix.length + bytes.length);
      payload.set(prefix);
      payload.set(bytes, prefix.length);
    }
    const result = await invoke<ArrayBuffer>("fetch_http_document", payload);

    signal?.throwIfAborted();
    const bytes = new Uint8Array(result);
    const end = bytes.indexOf(10);

    if (end === -1) throw new Error("Incomplete HTTP document");
    const meta: Metadata = JSON.parse((new TextDecoder).decode(bytes.subarray(0, end)));
    const responseBody = [204, 205, 304].includes(meta.status) || init?.method === "HEAD"
      ? null : bytes.subarray(end + 1);
    const response = new Response(responseBody, meta);

    Object.defineProperty(response, "url", { "value": meta.finalUrl });

    return response;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
