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

import type { SandboxHostMethodType } from "@/lib/extensions/sandbox/host/sandbox-host.ts";
import type {
  SandboxFetchClient,
  SandboxFetchResponse,
  SandboxLogLevel,
} from "@/lib/extensions/sandbox/protocol.ts";
import { type ParsedPermissionType, parsePermission } from "@/lib/permissions/parse-permission.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export type SandboxFetchRequestType = {
  "scope"      : "http-get" | "http-post";
  // The URL scope of the granted permission
  "argument"   : string;
  "client"     : SandboxFetchClient;
  "url"        : unknown;
  "body"       : unknown;
  "contentType": unknown;
};

export type SandboxHostDependenciesType = {
  // Reads the grant at call time, so a revoked permission takes effect immediately
  "isGranted"         : (permission: string) => boolean;
  "requestPermissions": (permissions: unknown) => Promise<Array<[string, boolean]>>;
  "writeLog"          : (level: SandboxLogLevel, input: Array<string>) => void;
  "readLog"           : () => Promise<string>;
  "fetch"             : (request: SandboxFetchRequestType) => Promise<SandboxFetchResponse>;
};

const LogLevels: ReadonlySet<unknown> = new Set<SandboxLogLevel>([
  "debug",
  "info",
  "warn",
  "error",
]);
const FetchClients: ReadonlySet<unknown> = new Set<SandboxFetchClient>(["web", "tauri"]);

export function getParameter(parameters: unknown, name: string): unknown {
  if (typeof parameters !== "object" || parameters === null || Array.isArray(parameters)) {
    throw new TypeError("The parameters must be an object");
  }

  return (parameters as Record<string, unknown>)[name];
}

/**
 * Checks that the call names a permission of the expected kind and that it is granted right now.
 *
 * @param parameters - untrusted call parameters with a 'permission' field
 * @param keys - accepted 'base::scope' values
 * @param isGranted - reads the current grant
 * @returns the parsed permission
 */
export function requireGrant(
  parameters: unknown,
  keys: ReadonlyArray<PermissionType>,
  isGranted: (permission: string) => boolean,
): ParsedPermissionType {
  const permission: unknown = getParameter(parameters, "permission");
  const parsed: ParsedPermissionType | undefined = parsePermission(permission);

  if (parsed === undefined || !keys.includes(parsed.key)) {
    throw new TypeError("The call names an unexpected permission");
  }

  if (!isGranted(permission as string)) {
    throw new Error(`The '${permission as string}' permission is not granted`);
  }

  return parsed;
}

/**
 * Builds the table of non-UI methods a plugin worker may call.
 *
 * @param dependencies - launcher functions the methods delegate to
 * @returns the method table
 */
export function createHostMethods(
  dependencies: SandboxHostDependenciesType,
): Record<string, SandboxHostMethodType> {
  const { isGranted } = dependencies;

  return {
    "requestPermissions": {
      "kind"  : "request",
      "handle": (parameters: unknown): Promise<Array<[string, boolean]>> => (
        dependencies.requestPermissions(getParameter(parameters, "permissions"))
      ),
    },
    "log.write": {
      "kind"  : "notify",
      "handle": (parameters: unknown): void => {
        requireGrant(parameters, ["log::write"], isGranted);

        const level: unknown = getParameter(parameters, "level");
        const input: unknown = getParameter(parameters, "input");

        if (!LogLevels.has(level) || !Array.isArray(input)) {
          throw new TypeError("Invalid log parameters");
        }

        dependencies.writeLog(level as SandboxLogLevel, input.map(String));
      },
    },
    "log.read": {
      "kind"  : "request",
      "handle": (parameters: unknown): Promise<string> => {
        requireGrant(parameters, ["log::read"], isGranted);

        return dependencies.readLog();
      },
    },
    "internet.fetch": {
      "kind"  : "request",
      "handle": (parameters: unknown): Promise<SandboxFetchResponse> => {
        const { key, argument } = requireGrant(
          parameters,
          ["internet::http-get", "internet::http-post"],
          isGranted,
        );
        const client: unknown = getParameter(parameters, "client");

        if (!FetchClients.has(client) || argument === undefined) {
          throw new TypeError("Invalid fetch parameters");
        }

        return dependencies.fetch({
          "scope"      : key === "internet::http-get" ? "http-get" : "http-post",
          argument,
          "client"     : client as SandboxFetchClient,
          "url"        : getParameter(parameters, "url"),
          "body"       : getParameter(parameters, "body"),
          "contentType": getParameter(parameters, "contentType"),
        });
      },
    },
  };
}
