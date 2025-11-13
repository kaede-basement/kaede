import { disableDebugMode } from "@/lib/development-mode-helpers/scopes/disable-debug-mode.ts";
import { enableDebugMode } from "@/lib/development-mode-helpers/scopes/enable-debug-mode.ts";

export const DevelopmentModeHelpers = {
  disableDebugMode,
  enableDebugMode,
} as const;
