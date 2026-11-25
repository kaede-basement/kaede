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

import { grantStaticPermissions } from "@/lib/permissions/grant-static-permissions.ts";
import { handlePermission } from "@/lib/permissions/handle-permission.ts";
import { hardenIfAvailable } from "@/lib/permissions/harden.ts";
import { permissionSession } from "@/lib/permissions/request-permissions.ts";
import type { ExtensionUI } from "@/lib/shared/ui-root.ts";

export function bindPermissionRequest(
  id: string, artifactSha256: string, ui?: ExtensionUI, signal?: AbortSignal,
) {
  const service = permissionSession.value;

  if (!service) {
    throw new Error("Permission session closed");
  }

  return async (input: unknown): Promise<Array<unknown>> => {
    const grants = await service.request(input, id, artifactSha256, signal);

    service.assertOpen(signal);
    const results = grants.map(permission => (
      permission && handlePermission(permission, id, ui, signal)
    ));

    return hardenIfAvailable(results);
  };
}

export default {
  grantStaticPermissions,
  handlePermission,
} as const;
