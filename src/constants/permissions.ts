import type { PermissionType } from "@/types/extensions/permission.type.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GrantedScopes: Record<string, any> = {};
export const IgnoredExtensionPermissions: Record<string, Partial<{
  [Key in PermissionType]: boolean;
}>> = {};
export const Permissions = {
  "Internet": {
    "General": "internet",
  },
  "ExternalStorage": {
    "Read" : "read-external-storage",
    "Write": "write-external-storage",
  },
  "InternalStorage": {
    "Read" : "read-internal-storage",
    "Write": "write-internal-storage",
  },
} as const;