import ExtensionsManager from "@/lib/extensions-manager";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function getDefaultConfig(): Promise<ConfigType> {
  const hooksResult: "continue" | ConfigType | undefined =
    await ExtensionsManager.catchAsyncResponseHooks({
      "scope" : "onDefaultConfigGet",
      "toPass": undefined,
      "timing": "before",
    });

  if (hooksResult !== "continue" && hooksResult !== undefined) {
    return hooksResult;
  }

  return {
    "development": null,
    "extensions" : {
      "enabled"                   : true,
      "allowUnrestrictedUntrusted": true,
    },
    "layout": {
      "currentInstance"        : null,
      "enableMaterialYouRipple": true,
      "custom"                 : false,
      "background"             : {
        "url"  : null,
        "key"  : null,
        "blur" : null,
        "color": null,
      },
      "sidebar": {
        "background": null,
        "blur"      : null,
        "color"     : null,
        "ripple"    : null,
        "sparkles"  : null,
      },
      "atAGlance": {
        "title"   : null,
        "subtitle": null,
      },
    },
    "logs": {
      "show"       : false,
      "lineBreaks" : false,
      "virtualized": false,
      "filtering"  : "",
    },
    "minecraft": {
      "windowHeight": 480,
      "windowWidth" : 854,
      "jvmArgs"     : "",
      "icon"        : "",
    },
    "misc": {
      "showAfterExtensionsInitialization": false,
      "enableDiscordRPC"                 : false,
      "autoConfigSync"                   : false,
    },
  };
}
