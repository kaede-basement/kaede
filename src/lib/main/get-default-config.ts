import type { ConfigType } from "@/types/config/config.schema.ts";
import { log } from "@/lib/handlers/log.ts";
import { ApplicationNamespace } from "@/constants/application.ts";
const { getCurrentWindow } = window.__TAURI__.api.window;

export async function getDefaultConfig(): Promise<ConfigType> {
  log.debug("Executing the 'before' method on extensions' hook for 'getDefaultConfig'");
  const hookResponse = await window[ApplicationNamespace].hooks.getDefaultConfig.before();

  if (hookResponse === "stop") {
    log.debug("'getConfigFile.before' hook has aborted execution");

    return await window[ApplicationNamespace].hooks.getDefaultConfig.onAbort();
  }

  log.debug("Getting current window theme");
  const currentTheme: "dark" | "light" = await getCurrentWindow().theme() ?? "dark";

  return {
    "__do_not_touch_VERSION": 1,
    "customization"         : {
      "theme"     : currentTheme,
      "accent"    : "rose",
      "background": "none",
    },
    "locale"               : "system",
    "minecraftWindowHeight": 480,
    "minecraftWindowWidth" : 854,
  };
}
