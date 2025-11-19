import { GrantedScopes } from "@/constants/permissions.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export function handlePermission(permission: PermissionType, id: string): void {
  if (!GrantedScopes[id]["__allowed"]) {
    GrantedScopes[id]["__allowed"] = [];
  }

  GrantedScopes[id]["__allowed"].push(permission);
  GrantedScopes[id].fetch = fetch.bind({});
}