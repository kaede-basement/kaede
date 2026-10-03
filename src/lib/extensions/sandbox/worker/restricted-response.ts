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

import type { SandboxFetchResponse } from "@/lib/extensions/sandbox/protocol.ts";

type RestrictedBlobType = {
  "size"       : number;
  "type"       : string;
  "arrayBuffer": () => Promise<ArrayBuffer>;
  "text"       : () => Promise<string>;
  "slice"      : (start?: number, end?: number, contentType?: string) => RestrictedBlobType;
};
type RestrictedResponseType = {
  "json"       : () => Promise<unknown>;
  "text"       : () => Promise<string>;
  "arrayBuffer": () => Promise<ArrayBuffer>;
  "blob"       : () => Promise<RestrictedBlobType>;
  "ok"         : boolean;
  "redirected" : boolean;
  "status"     : number;
  "statusText" : string;
  "type"       : string;
  "url"        : string;
};

/**
 * Rebuilds the 'RestrictedResponse' surface that sandboxed plugins used before
 * from a response received as data.
 *
 * @param response - the response data sent by the launcher
 * @param decoder - a UTF-8 decoder captured before the plugin runs
 * @returns a frozen response object
 */
export function buildRestrictedResponse(
  response: SandboxFetchResponse,
  decoder: TextDecoder,
): RestrictedResponseType {
  const { body } = response;

  const buildBlob = (buffer: ArrayBuffer, type: string): RestrictedBlobType => Object.freeze({
    "size"       : buffer.byteLength,
    type,
    "arrayBuffer": async () => buffer.slice(0, buffer.byteLength),
    "text"       : async () => decoder.decode(buffer),
    "slice"      : (start?: number, end?: number, contentType: string = "") => (
      buildBlob(buffer.slice(start, end), contentType)
    ),
  });

  return Object.freeze({
    "json"       : async () => JSON.parse(decoder.decode(body)) as unknown,
    "text"       : async () => decoder.decode(body),
    "arrayBuffer": async () => body.slice(0, body.byteLength),
    "blob"       : async () => buildBlob(body, response.contentType.toLowerCase()),
    "ok"         : response.ok,
    "redirected" : response.redirected,
    "status"     : response.status,
    "statusText" : response.statusText,
    "type"       : response.type,
    "url"        : response.url,
  });
}
