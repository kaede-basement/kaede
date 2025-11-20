import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function enableDebugMode(developmentModeEntries: GlobalStatesType["development"]): void {
  const currentDevelopmentMode = developmentModeEntries ?? GlobalStateHelpers.get()?.development;

  if (!currentDevelopmentMode) {
    log.error("Debug mode was triggered, but development mode is disabled.");

    return;
  }

  GlobalStateHelpers.change("development", {
    ...currentDevelopmentMode,
    "enableDebugMode": true,
  });

  log.debug = log["__debug-defined"];
  log.warn("Debug mode enabled");
}
