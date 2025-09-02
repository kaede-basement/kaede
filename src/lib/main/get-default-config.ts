import type { ConfigType } from "@/types/config/config.schema.ts";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { log } from "@/lib/handlers/log.ts";
import { ApplicationNamespace } from "@/constants/application.ts";

export async function getDefaultConfig(): Promise<ConfigType> {
  log.debug("Executing the 'before' method on extensions' hook for 'getDefaultConfig'");
  await window[ApplicationNamespace].hooks.getDefaultConfig.before();

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
