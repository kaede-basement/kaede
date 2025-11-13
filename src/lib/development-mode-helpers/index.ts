import { disableDebugMode } from "@/lib/development-mode-helpers/scopes/disable-debug-mode.ts";
import { enableDebugMode } from "@/lib/development-mode-helpers/scopes/enable-debug-mode.ts";
import {
  handleNativeReloadKeyBinds,
} from "@/lib/development-mode-helpers/scopes/handle-native-reload-key-binds.ts";

export const DevelopmentModeHelpers = {
  disableDebugMode,
  enableDebugMode,
  handleNativeReloadKeyBinds,
} as const;
