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
import {
  fetchWithinScope, type Transport, validateContentType,
} from "@/lib/permissions/internet-scope.ts";
import { hardenIfAvailable } from "@/lib/permissions/request-permissions.ts";

type RestrictedBlob = {
  "size"       : number;
  "type"       : string;
  "arrayBuffer": () => Promise<ArrayBuffer>;
  "text"       : () => Promise<string>;
  "slice"      : (start?: number, end?: number, contentType?: string) => RestrictedBlob;
};
type RestrictedResponse = {
  "json"       : Response["json"];
  "text"       : Response["text"];
  "arrayBuffer": Response["arrayBuffer"];
  "blob"       : () => Promise<RestrictedBlob>;
  "ok"         : boolean;
  "redirected" : boolean;
  "status"     : number;
  "statusText" : string;
  "type"       : Response["type"];
  "url"        : string;
};

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

function buildSafeBlob(blob: Blob): RestrictedBlob {
  return hardenIfAvailable({
    "size"       : blob.size,
    "type"       : blob.type,
    "arrayBuffer": async () => {
      const buffer: ArrayBuffer = await blob.arrayBuffer();

      return hardenIfAvailable(buffer);
    },
    "text": async () => {
      const text: string = await blob.text();

      return text;
    },
    "slice": (start?: number, end?: number, contentType?: string): RestrictedBlob => {
      return buildSafeBlob(blob.slice(start, end, contentType));
    },
  });
}
function buildSafeResponse(response: Response): RestrictedResponse {
  return hardenIfAvailable({
    "json": async () => {
      const json = await response.json();

      return hardenIfAvailable(json);
    },
    "text": async () => {
      const text: string = await response.text();

      return text;
    },
    "arrayBuffer": async () => {
      const buffer: ArrayBuffer = await response.arrayBuffer();

      return hardenIfAvailable(buffer);
    },
    "blob": async (): Promise<RestrictedBlob> => {
      const blob: Blob = await response.blob();

      return buildSafeBlob(blob);
    },
    "ok"        : response.ok,
    "redirected": response.redirected,
    "status"    : response.status,
    "statusText": response.statusText,
    "type"      : response.type,
    "url"       : response.url,
  });
}

export function handleInternetPermission({ id, scope, argument }: {
  "id"      : string;
  "scope"   : "http-get" | "http-post";
  "argument": URL;
}): unknown {
  const method = scope === "http-get" ? "GET" : "POST";

  const scopedFetch = (transport: Transport) => async (
    url: string, body?: string | ArrayBuffer | Uint8Array<ArrayBuffer>, contentType = "text/plain",
  ): Promise<RestrictedResponse> => {
    const options: RequestInit = { method, "redirect": "manual" };

    if (method === "POST") {
      validateRequestBody(body);
      options.body = body;
      options.headers = { "Content-Type": validateContentType(contentType) };
    }
    log.debug(__PRE_BUNDLED_FILENAME__, `The '${id}' plugin made a ${method} request`);

    return buildSafeResponse(await fetchWithinScope(transport, url, argument, options));
  };

  return hardenIfAvailable({
    "webFetch"  : scopedFetch(fetch),
    "tauriFetch": scopedFetch((url, options) => tauriFetch(url, {
      ...options, "maxRedirections": 0,
    })),
  });
}
