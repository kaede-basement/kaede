import { ApplicationNamespace } from "@/constants/application.ts";
import { handlePermission } from "@/lib/extensions-manager/scopes/handle-permission.ts";
import { readAllExtensions } from "@/lib/extensions-manager/scopes/read-all-extensions.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export default {
  "requestPermissions": (
    permissions: Array<PermissionType>,
    extension: string,
  ): Promise<Array<boolean>> => window[ApplicationNamespace].__internals.requestPermissions(
    permissions,
    extension,
  ),
  handlePermission,
  readAllExtensions,
} as const;