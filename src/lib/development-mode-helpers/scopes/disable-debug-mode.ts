import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";

export function disableDebugMode(): void {
  const currentDevelopmentMode = GlobalStateHelpers.get()?.development;

  if (!currentDevelopmentMode) {
    log.warn("Debug mode is already disabled.");

    return;
  }

  GlobalStateHelpers.change("development", {
    ...currentDevelopmentMode,
    "enableDebugMode": false,
  });

  log.debug = log["__debug-undefined"];
  log.info("Debug mode disabled");
}
