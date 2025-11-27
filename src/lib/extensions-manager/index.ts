import { ApplicationNamespace } from "@/constants/application.ts";
import { handleCssTheme } from "@/lib/extensions-manager/scopes/handle-css-theme.ts";
import { handlePermission } from "@/lib/extensions-manager/scopes/handle-permission.ts";
import { initializeDirectory } from "@/lib/extensions-manager/scopes/initialize-directory.ts";
import { lockdownEnvironment } from "@/lib/extensions-manager/scopes/lockdown-environment.ts";
import { readAllExtensions } from "@/lib/extensions-manager/scopes/read-all-extensions.ts";
import { readAllMetadata } from "@/lib/extensions-manager/scopes/read-all-metadata.ts";
import { runInSandbox } from "@/lib/extensions-manager/scopes/run-in-sandbox.ts";
import { runInUnrestricted } from "@/lib/extensions-manager/scopes/run-in-unrestricted.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export default {
  "requestPermissions": (
    permissions: Array<PermissionType>,
    extension: string,
  ): Promise<Array<boolean>> => window[ApplicationNamespace].__internals.requestPermissions(
    permissions,
    extension,
  ),
  handleCssTheme,
  handlePermission,
  initializeDirectory,
  lockdownEnvironment,
  readAllExtensions,
  readAllMetadata,
  runInSandbox,
  runInUnrestricted,
} as const;