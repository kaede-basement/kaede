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

import { getGrantKey } from "@/lib/permissions/get-grant-key.ts";
import { parsePermission } from "@/lib/permissions/parse-permission.ts";
import { globalStates } from "@/states/global.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

type PromptType = (
  permission?: PermissionType | string,
  extension?: string,
  resolve?: (state: boolean) => void
) => void;

// The prompt shows one permission at a time, so concurrent requests wait for their turn
let queue: Promise<unknown> = Promise.resolve();
// Requests made before the prompt was closed belong to an older generation
let generation: number = 0;
let cancelPrompt: ((reason: Error) => void) | undefined;

// The prompt is closed when the extensions loader unmounts, and nobody would answer it anymore
export function __cancelPermissionRequests(): void {
  generation++;
  cancelPrompt?.(new Error("The permission prompt was closed"));
}

/**
 * Asks the user for every permission that has no recorded decision yet.
 *
 * @param permissions - an untrusted value provided by the plugin
 * @param extension - the plugin ID shown in the prompt
 * @param artifactSha256 - the artifact whose decisions are recorded
 * @param request - shows the permission modal, or hides it when called without arguments
 * @returns a '[permission, granted]' pair for every requested permission
 */
export function __requestPermissions(
  permissions: Array<PermissionType | string> | unknown,
  extension: string,
  // Grants are stored per artifact, so a changed archive with the same ID does not inherit them
  artifactSha256: string,
  request: PromptType,
): Promise<Array<[string, boolean]>> {
  const requestGeneration: number = generation;
  const current = queue.then(() => {
    if (requestGeneration !== generation) {
      throw new Error("The permission prompt was closed");
    }

    return requestInTurn(permissions, extension, artifactSha256, request);
  });

  // A failed request must not block the ones after it
  queue = current.catch(() => {});

  return current;
}

async function requestInTurn(
  permissions: Array<PermissionType | string> | unknown,
  extension: string,
  artifactSha256: string,
  request: PromptType,
): Promise<Array<[string, boolean]>> {
  if (!Array.isArray(permissions)) {
    throw new TypeError("Permissions must be an array");
  }

  /*
   * The array comes from the extension, which can override its methods (including the iterator)
   * or change it while a prompt is open, so each index is read and checked once,
   * and only the copy is used.
   * The check runs before any prompt, since the prompt treats an empty permission as 'close'
   */
  const requested: Array<string> = Array.from(
    { "length": permissions.length },
    (_, index: number): string => {
      const permission: unknown = permissions[index];

      if (parsePermission(permission) === undefined) {
        const label: string = typeof permission === "string" ? permission : typeof permission;

        throw new TypeError(`Unknown permission: ${label}`);
      }

      return permission as string;
    },
  );

  const currentPermissions = globalStates.extensions.permissions;
  const key: string = getGrantKey(artifactSha256);
  const granted: Array<[string, boolean]> = [];

  try {
    for (const permission of requested) {
      const hasPermission: boolean | undefined = currentPermissions?.[key]?.[permission];

      if (hasPermission !== undefined) {
        granted.push([permission, hasPermission]);

        continue;
      }

      // This triggers a modal window with two buttons: 'allow' and 'disallow'
      const allowed = await new Promise((
        resolve: (state: boolean) => void,
        reject: (reason: Error) => void,
      ) => {
        cancelPrompt = reject;
        request(permission, extension, resolve);
      });

      if (currentPermissions[key] === undefined) {
        currentPermissions[key] = {};
      }

      currentPermissions[key][permission] = allowed;
      granted.push([permission, allowed]);
    }
  } finally {
    cancelPrompt = undefined;
    // Clear the permissions request state by passing nothing, also when a grant failed
    request();
  }

  return granted;
}
