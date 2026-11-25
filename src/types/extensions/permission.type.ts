import type { Permissions } from "@/constants/permissions.ts";

type PermissionsObjectType = typeof Permissions;
type PermissionsKeyType = keyof PermissionsObjectType;

type PermissionName = {
  [Key in PermissionsKeyType]: PermissionsObjectType[Key][keyof PermissionsObjectType[Key]];
}[PermissionsKeyType];
type InternetPermission = typeof Permissions.Internet[keyof typeof Permissions.Internet];

export type PermissionType =
  | Exclude<PermissionName, InternetPermission>
  | `${InternetPermission}::${"http" | "https"}://${string}`;
