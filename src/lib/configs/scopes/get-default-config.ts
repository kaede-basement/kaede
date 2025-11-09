import { getCurrentWindow } from "@tauri-apps/api/window";

import { ApplicationNamespace } from "@/constants/application.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/application/config.type.ts";

export async function getDefaultConfig(): Promise<ConfigType> {
  const hooksArray = window[ApplicationNamespace].hooks.getDefaultConfig.before;

  log.debug("Starting iterating through hooks for 'getDefaultConfig.before'");
  for (const [hookIndex, hookFunction] of hooksArray.entries()) {
    log.debug("Executing a hook with the next index:", hookIndex.toString());
    const hookResponse = await hookFunction();

    if (hookResponse.status === "stop") {
      log.debug(`A hook with the index of ${hookIndex} has aborted execution`);

      // Awaiting here will just be an unnecessary action
      return hookResponse.response;
    }
  }

  log.debug("Getting current window theme");
  const currentTheme: "dark" | "light" = await getCurrentWindow().theme() ?? "dark";

  return {
    "customization": {
      "theme"     : currentTheme,
      "accent"    : "rose",
      "background": "none",
    },
    "locale"               : "en",
    "minecraftWindowHeight": 480,
    "minecraftWindowWidth" : 854,
  };
}
