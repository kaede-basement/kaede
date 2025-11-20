import { IgnoredExtensionPermissions } from "@/constants/permissions.ts";
import { handlePermission } from "@/lib/extensions-manager/scopes/handle-permission.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export async function __requestPermissions(
  permissions: Array<PermissionType>,
  extension: string,
  request: (
    permission?: PermissionType,
    extension?: string,
    resolve?: (state: boolean) => void
  ) => void,
): Promise<Array<boolean>> {
  const states = [];

  for (const permission of permissions) {
    const isIgnored: boolean | undefined = IgnoredExtensionPermissions?.[extension]?.[permission];

    if (isIgnored !== undefined) {
      if (isIgnored) {
        handlePermission(permission, extension);
      }

      continue;
    }

    const state = await new Promise((resolve: (value: boolean) => void) => {
      request(permission, extension, resolve);
    });

    if (state) {
      handlePermission(permission, extension);
    }

    states.push(state);
  }

  // Clear the permissions request state by passing nothing
  request();

  return states;
}