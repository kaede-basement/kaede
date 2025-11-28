import { GrantedScopes } from "@/constants/permissions.ts";
import { handlePermission } from "@/lib/extensions-manager/scopes/handle-permission.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export function grantStaticPermissions({
  id,
  permissions,
}: {
  "id"          : string;
  "permissions"?: Array<PermissionType>;
}): object {
  GrantedScopes[id] = {};

  if (!permissions) {
    return {};
  }

  for (const permission of permissions) {
    handlePermission(permission, id);
  }

  return GrantedScopes[id];
}