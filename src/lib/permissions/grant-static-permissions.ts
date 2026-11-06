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
import { handlePermission } from "@/lib/permissions/handle-permission.ts";
import { globalStates } from "@/states/global.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export function grantStaticPermissions({
  id,
  artifactSha256,
  permissions,
}: {
  "id"            : string;
  // Grants are stored per artifact, so a changed archive with the same ID does not inherit them
  "artifactSha256": string;
  "permissions"?  : Array<PermissionType>;
}): Record<string, unknown> {
  const currentPermissions = globalStates.extensions.permissions;
  const scopedThis: Record<string, unknown> = {};

  if (!permissions) {
    return scopedThis;
  }

  const key: string = getGrantKey(artifactSha256);

  if (currentPermissions?.[key] === undefined) {
    currentPermissions[key] = {};
  }

  for (const permission of permissions) {
    scopedThis[permission] = handlePermission(permission, id);
    currentPermissions[key][permission] = true;
  }

  return harden(scopedThis);
}
