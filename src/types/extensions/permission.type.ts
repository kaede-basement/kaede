import type { Permissions } from "@/constants/permissions.ts";

type PermissionsObjectType = typeof Permissions;
type PermissionsKeyType = keyof PermissionsObjectType;

export type PermissionType = {
  [Key in PermissionsKeyType]: PermissionsObjectType[Key][keyof PermissionsObjectType[Key]];
}[PermissionsKeyType];