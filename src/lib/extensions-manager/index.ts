import { ApplicationNamespace } from "@/constants/application.ts";
import {
  onGlobalStateChange,
} from "@/lib/extensions-manager/scopes/events/on-global-state-change.ts";
import { grantEventListeners } from "@/lib/extensions-manager/scopes/grant-event-listeners.ts";
import {
  grantStaticPermissions,
} from "@/lib/extensions-manager/scopes/grant-static-permissions.ts";
import { handleCssTheme } from "@/lib/extensions-manager/scopes/handle-css-theme.ts";
import { handleEvent } from "@/lib/extensions-manager/scopes/handle-event.ts";
import { handlePermission } from "@/lib/extensions-manager/scopes/handle-permission.ts";
import { lockdownEnvironment } from "@/lib/extensions-manager/scopes/lockdown-environment.ts";
import { readAllExtensions } from "@/lib/extensions-manager/scopes/read-all-extensions.ts";
import { readAllMetadata } from "@/lib/extensions-manager/scopes/read-all-metadata.ts";
import { runInSandbox } from "@/lib/extensions-manager/scopes/run-in-sandbox.ts";
import { runInUnrestricted } from "@/lib/extensions-manager/scopes/run-in-unrestricted.ts";
import { showWebviewWindow } from "@/lib/extensions-manager/scopes/show-webview-window.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export default {
  "requestPermissions": (
    permissions: Array<PermissionType>,
    extension: string,
  ): Promise<Array<boolean>> => window[ApplicationNamespace].__internals.requestPermissions(
    permissions,
    extension,
  ),
  onGlobalStateChange,
  grantEventListeners,
  grantStaticPermissions,
  handleCssTheme,
  handleEvent,
  handlePermission,
  lockdownEnvironment,
  readAllExtensions,
  readAllMetadata,
  runInSandbox,
  runInUnrestricted,
  showWebviewWindow,
} as const;