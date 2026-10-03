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

/**
 * Records the permissions declared in the plugin metadata as granted.
 *
 * @param artifactSha256 - the artifact whose grants are recorded
 * @param permissions - permissions from the plugin metadata
 * @returns the granted permissions
 */
export function grantStaticPermissions({
  artifactSha256,
  permissions = [],
}: {
  // Grants are stored per artifact, so a changed archive with the same ID does not inherit them
  "artifactSha256": string;
  "permissions"?  : Array<PermissionType | string>;
}): Array<string> {
  for (const permission of permissions) {
    if (parsePermission(permission) === undefined) {
      throw new TypeError(`The static permission '${permission}' is invalid`);
    }
  }

  const currentPermissions = globalStates.extensions.permissions;
  const key: string = getGrantKey(artifactSha256);

  if (currentPermissions[key] === undefined) {
    currentPermissions[key] = {};
  }

  for (const permission of permissions) {
    currentPermissions[key][permission] = true;
  }

  return [...permissions];
}
