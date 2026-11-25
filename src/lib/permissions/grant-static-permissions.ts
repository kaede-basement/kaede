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
import { globalStates } from "@/states/global.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export function grantStaticPermissions({
  id,
  artifactSha256,
  permissions = [],
}: {
  "id"            : string;
  "artifactSha256": string;
  "permissions"?  : Array<PermissionType>;
}): Record<string, unknown> {
  const currentPermissions = globalStates.extensions.permissions;
  const scopedThis: Record<string, unknown> = {};

  const key = artifactGrantKey(artifactSha256);

  for (const permission of permissions) {
    if (!parsePermission(permission)) {
      throw new TypeError("Invalid static permission");
    }
    scopedThis[permission] = handlePermission(permission, id);
  }
  for (const permission of Object.keys(scopedThis)) {
    currentPermissions[key] ??= {};
    if (currentPermissions[key][permission] !== true) {
      currentPermissions[key][permission] = true;
    }
  }

  return harden(scopedThis);
}
