/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import "ses";

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import { log } from "@/lib/logging/log.ts";
import { hardenIfAvailable } from "@/lib/permissions/harden.ts";
import {
  fetchWithinScope, type Transport, validateContentType,
} from "@/lib/permissions/internet-scope.ts";
import {
  buildSafeResponse, type ResponseMetadata, type RestrictedResponse,
} from "@/lib/permissions/safe-response.ts";
import { throwIfAborted } from "@/lib/shared/abort.ts";

function validateRequestBody(body: unknown): void {
  const isValidBody: boolean = (
    body === undefined ||
    typeof body === "string" ||
    ArrayBuffer.isView(body) ||
    body instanceof ArrayBuffer
  );

  if (!isValidBody) {
    throw new TypeError("The request body must be a string");
  }
}

type InternetScope = {
  "id"      : string;
  "scope"   : "http-get" | "http-post";
  "argument": URL;
};

export async function fetchForExtension(
  { id, scope, argument }: InternetScope, transport: "webFetch" | "tauriFetch",
  url: string, body?: string | ArrayBuffer | Uint8Array<ArrayBuffer>,
  contentType = "text/plain", signal?: AbortSignal,
): Promise<{
  "metadata"   : ResponseMetadata;
  "arrayBuffer": () => Promise<ArrayBuffer>;
  "release"?   : () => void;
}> {
  throwIfAborted(signal);
  const method = scope === "http-get" ? "GET" : "POST";
  const options: RequestInit = { method, "redirect": "manual", signal };

  if (method === "POST") {
    validateRequestBody(body);
    options.body = body;
    options.headers = { "Content-Type": validateContentType(contentType) };
  }
  log.debug(__PRE_BUNDLED_FILENAME__, `The '${id}' plugin made a ${method} request`);

  // Plugin-http retains both request and body listeners on the supplied signal.
  const child = transport === "tauriFetch" && signal ? new AbortController : undefined;
  const abort = (): void => child?.abort(signal?.reason);
  const detach = (): void => signal?.removeEventListener("abort", abort);
  const send: Transport = transport === "webFetch" ? fetch : (href, init): Promise<Response> => (
    tauriFetch(href, { ...init, "signal": child?.signal, "maxRedirections": 0 })
  );

  if (child) signal?.addEventListener("abort", abort, { "once": true });
  let pendingBody = false;

  try {
    const response = await fetchWithinScope(send, url, argument, options);

    const release = (): void => {
      if (child) detach();
      void response.body?.cancel().catch(() => {});
    };

    if (signal?.aborted) {
      release();
      throwIfAborted(signal);
    }
    const { ok, redirected, status, statusText, type, "url": responseUrl } = response;
    const headers = [...response.headers].filter(([name]) => (
      name !== "set-cookie" && name !== "set-cookie2"
    ));

    pendingBody = !!response.body;

    return {
      "metadata": { ok, redirected, status, statusText, type, "url": responseUrl, headers },
      "release" : pendingBody ? release : undefined,
      async arrayBuffer(): Promise<ArrayBuffer> {
        throwIfAborted(signal);
        if (response.bodyUsed) throw new TypeError("Response body already consumed");
        try {
          return await response.arrayBuffer();
        } finally {
          if (child) detach();
        }
      },
    };
  } finally {
    if (child && !pendingBody) detach();
  }
}

export function handleInternetPermission(scope: InternetScope, signal?: AbortSignal): unknown {
  const bind = (transport: "webFetch" | "tauriFetch") => async (
    url: string, body?: string | ArrayBuffer | Uint8Array<ArrayBuffer>, contentType?: string,
  ): Promise<RestrictedResponse> => {
    const response = await fetchForExtension(scope, transport, url, body, contentType, signal);

    return buildSafeResponse(response.metadata, response.arrayBuffer, response.release);
  };

  return hardenIfAvailable({ "webFetch": bind("webFetch"), "tauriFetch": bind("tauriFetch") });
}
