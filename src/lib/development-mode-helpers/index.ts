import { disableDebugMode } from "@/lib/development-mode-helpers/scopes/disable-debug-mode.ts";
import { enableDebugMode } from "@/lib/development-mode-helpers/scopes/enable-debug-mode.ts";
import { exit } from "@/lib/development-mode-helpers/scopes/exit.ts";
import {
  getDefaultDevelopmentStates,
} from "@/lib/development-mode-helpers/scopes/get-default-development-states.ts";
import {
  handleNativeReloadKeyBinds,
} from "@/lib/development-mode-helpers/scopes/handle-native-reload-key-binds.ts";
import { initialize } from "@/lib/development-mode-helpers/scopes/initialize.ts";

export default {
  "getDefault": getDefaultDevelopmentStates,
  disableDebugMode,
  enableDebugMode,
  exit,
  handleNativeReloadKeyBinds,
  initialize,
} as const;
