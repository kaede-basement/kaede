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

import type {
  SandboxFetchClient,
  SandboxFetchResponse,
  SandboxLogLevel,
} from "@/lib/extensions/sandbox/protocol.ts";
import { createUIStubs } from "@/lib/extensions/sandbox/worker/ark-proxy.ts";
import { buildRestrictedResponse } from "@/lib/extensions/sandbox/worker/restricted-response.ts";
import type { WorkerRpcType } from "@/lib/extensions/sandbox/worker/worker-rpc.ts";

export type WorkerCapturesType = {
  "Date"          : DateConstructor;
  "queueMicrotask": (callback: () => void) => void;
  "decoder"       : TextDecoder;
  "performanceNow": () => number;
  "timeOrigin"    : number;
};

/**
 * Builds the plugin-facing object of a granted permission. Every call that leaves
 * the worker names the exact permission, and the launcher checks the grant again.
 *
 * @param rpc - the worker side of the launcher protocol
 * @param captures - originals captured before the global object was stripped
 * @returns a function that returns the API object of a permission,
 * or 'undefined' for permissions without one
 */
export function createPermissionStubs(
  rpc: WorkerRpcType,
  captures: WorkerCapturesType,
): (permission: string) => unknown {
  const write = (permission: string, level: SandboxLogLevel) => (
    (...input: Array<unknown>): void => rpc.notify("log.write", {
      permission,
      level,
      "input": input.map(String),
    })
  );
  const request = async (
    permission: string,
    client: SandboxFetchClient,
    url: unknown,
    body?: unknown,
    contentType?: unknown,
  ): Promise<unknown> => {
    const response: unknown = await rpc.call(
      "internet.fetch",
      { permission, client, url, body, contentType },
    );

    return buildRestrictedResponse(response as SandboxFetchResponse, captures.decoder);
  };
  const createDocument = createUIStubs(rpc, captures.queueMicrotask);
  const performance = Object.freeze({
    "timeOrigin": captures.timeOrigin,
    "now"       : (): number => captures.performanceNow(),
  });

  return (permission: string): unknown => {
    const [base, scope] = permission.split("::");

    switch (`${base}::${scope}`) {
      case "log::write": {
        return Object.freeze({
          "debug": write(permission, "debug"),
          "info" : write(permission, "info"),
          "warn" : write(permission, "warn"),
          "error": write(permission, "error"),
        });
      }
      case "log::read": {
        return async (): Promise<unknown> => rpc.call("log.read", { permission });
      }
      case "log::stream": {
        return Object.freeze({});
      }
      case "internet::http-get": {
        return Object.freeze({
          "webFetch"  : (url: unknown) => request(permission, "web", url),
          "tauriFetch": (url: unknown) => request(permission, "tauri", url),
        });
      }
      case "internet::http-post": {
        return Object.freeze({
          "webFetch": (url: unknown, body?: unknown, contentType?: unknown) => (
            request(permission, "web", url, body, contentType)
          ),
          "tauriFetch": (url: unknown, body?: unknown, contentType?: unknown) => (
            request(permission, "tauri", url, body, contentType)
          ),
        });
      }
      case "time::performance": {
        return Object.freeze({ performance });
      }
      case "time::date": {
        return Object.freeze({ "Date": captures.Date });
      }
      case "ui::basic":
      case "ui::interactivity": {
        return createDocument(permission);
      }
      default: {
        return undefined;
      }
    }
  };
}
