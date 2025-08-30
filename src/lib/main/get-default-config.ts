import type { ConfigType } from "@/types/config/config.schema.ts";

export function getDefaultConfig(): ConfigType {
  return {
    "__do_not_touch_VERSION": 1,
    "customization"         : {
      "theme"     : "dark",
      "accent"    : "rose",
      "background": "none",
    },
    "locale"               : "system",
    "minecraftWindowHeight": 480,
    "minecraftWindowWidth" : 854,
  };
}
