import { ApplicationNamespace, DefaultLocale } from "@/constants/application.ts";
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

  return {
    "development": {
      "enabled"                   : false,
      "enableDebugMode"           : false,
      "enableNativeReloadKeyBinds": false,
      "showFPS"                   : false,
    },
    "layout": {
      "custom"    : false,
      "background": {
        "url"  : undefined,
        "key"  : undefined,
        "blur" : undefined,
        "color": undefined,
      },
      "sidebar": {
        "background": undefined,
        "blur"      : undefined,
        "color"     : undefined,
        "ripple"    : undefined,
        "sparkles"  : undefined,
      },
    },
    "locale": DefaultLocale,
    "logs"  : {
      "show"       : false,
      "lineBreaks" : false,
      "virtualized": false,
      "dates"      : false,
      "filtering"  : "",
    },
    "minecraft": {
      "windowHeight": 480,
      "windowWidth" : 854,
      "jvmArgs"     : "",
    },
    "misc": {
      "enableDiscordRPC"        : false,
      "showBeforeInitialization": false,
    },
  };
}
