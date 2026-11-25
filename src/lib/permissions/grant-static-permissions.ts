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

import { handlePermission } from "@/lib/permissions/handle-permission.ts";
import { parsePermission } from "@/lib/permissions/parse-permission.ts";
import { artifactGrantKey } from "@/lib/permissions/request-permissions.ts";
import type { ExtensionUI } from "@/lib/shared/ui-root.ts";
import { globalStates } from "@/states/global.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export function grantStaticPermissions({
  id,
  artifactSha256,
  permissions = [],
  ui, signal,
}: {
  "id"            : string;
  "artifactSha256": string;
  "signal"?       : AbortSignal;
  "ui"?           : ExtensionUI;
  "permissions"?  : Array<PermissionType>;
}): Record<string, unknown> {
  recordStaticGrants(artifactSha256, permissions);
  const scopedThis = Object.fromEntries(
    permissions.map(raw => [raw, handlePermission(raw, id, ui, signal)]),
  );

  return harden(scopedThis);
}


export function recordStaticGrants(artifactSha256: string, permissions: string[]): void {
  const key = artifactGrantKey(artifactSha256);
  const current = globalStates.extensions.permissions;

  if (!permissions.every(raw => parsePermission(raw))) {
    throw new TypeError("Invalid static permission");
  }
  for (const raw of permissions) {
    (current[key] ??= {})[raw] = true;
  }
}
