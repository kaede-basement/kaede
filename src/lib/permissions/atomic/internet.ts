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

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import type { SandboxFetchRequestType } from "@/lib/extensions/sandbox/host/host-methods.ts";
import type { SandboxFetchResponse } from "@/lib/extensions/sandbox/protocol.ts";
import { log } from "@/lib/logging/log.ts";

function guard(input: string | unknown, allowed: string): void {
  if (typeof input !== "string") {
    throw new TypeError("The input URL for the fetch should be a string");
  }

  const requestUrl = new URL(input);
  const scopeUrl = new URL(allowed);

  // Let the scope 'https://github.com/safeProfile' not allow 'https://github.com/safeProfileOhNotSoSafe'
  const scopePath: string = scopeUrl.pathname.endsWith("/")
    ? scopeUrl.pathname
    : scopeUrl.pathname + "/";
  const allowedOrigin: boolean = requestUrl.origin === scopeUrl.origin;
  const allowedPath: boolean =
    requestUrl.pathname === scopeUrl.pathname ||
    requestUrl.pathname.startsWith(scopePath);

  if (!allowedOrigin || !allowedPath) {
    throw new Error(`This request (${requestUrl.href}) goes out of your allowed scope`);
  }
}
function validateRequestData(body: unknown, contentType: unknown): void {
  const isValidBody: boolean = (
    body === undefined ||
    typeof body === "string" ||
    ArrayBuffer.isView(body) ||
    body instanceof ArrayBuffer
  );

  if (!isValidBody) {
    throw new TypeError("The request body must be a string");
  }

  if (typeof contentType !== "string") {
    throw new TypeError("The request 'Content-Type' header must be a string");
  }

  switch (contentType.toLowerCase()) {
    // 'https://www.iana.org/assignments/media-types/media-types.xhtml'
    case "text/plain":
    case "image/gif":
    case "image/jpeg":
    case "image/png":
    case "video/mpeg":
    case "video/mp4":
    case "video/webm":
    case "application/json; charset=utf-8":
    case "application/json;charset=utf-8":
    case "application/json":
    case "application/zip":
    case "application/x-www-form-urlencoded":
    case "application/ogg":
    case "audio/mpeg": {
      break;
    }
    default: {
      throw new Error("The provided content type is not allowed");
    }
  }
}

function hook({ id, url, argument, method, label, body }: {
  "id"      : string;
  "url"     : string | unknown;
  "argument": string;
  "method"  : "GET" | "POST";
  "label"   : "Web" | "Tauri";
  "body"   ?: Uint8Array | ArrayBuffer | string;
}): void {
  guard(url, argument);
  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
    `The '${id}' plugin made a ${label} fetch call with the next params`,
    { url, argument, method, body },
  ));
}

/**
 * Performs a fetch for a sandboxed plugin after the host checked its grant.
 * The URL must stay inside the granted scope, redirects are not followed,
 * and POST bodies are restricted.
 *
 * @param id - a string that represents the plugin ID
 * @param request - untrusted request parameters and the granted URL scope
 * @returns the response reduced to data
 */
export async function fetchForPlugin(
  id: string,
  { scope, argument, client, url, body, contentType = "text/plain" }: SandboxFetchRequestType,
): Promise<SandboxFetchResponse> {
  const method = scope === "http-get" ? "GET" as const : "POST" as const;
  const init: RequestInit = { method, "redirect": "manual" };

  if (method === "POST") {
    validateRequestData(body, contentType);
    init.body = body as BodyInit | undefined;
    init.headers = { "Content-Type": contentType as string };
  }

  hook({
    id,
    url,
    argument,
    method,
    "label": client === "web" ? "Web" : "Tauri",
    "body" : init.body as string | ArrayBuffer | Uint8Array | undefined,
  });

  const response: Response = await (client === "web" ? fetch : tauriFetch)(url as string, init);

  return {
    "status"     : response.status,
    "statusText" : response.statusText,
    "ok"         : response.ok,
    "redirected" : response.redirected,
    "type"       : response.type,
    "url"        : response.url,
    "contentType": response.headers.get("content-type") ?? "",
    "body"       : await response.arrayBuffer(),
  };
}
