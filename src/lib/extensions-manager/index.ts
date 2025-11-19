import { ApplicationNamespace } from "@/constants/application.ts";
import { readAllExtensions } from "@/lib/extensions-manager/scopes/read-all-extensions.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export default {
  "requestPermissions": (
    permissions: Array<PermissionType>,
    extension: string,
  ) => window[ApplicationNamespace].__internals.requestPermissions(permissions, extension),
  readAllExtensions,
} as const;