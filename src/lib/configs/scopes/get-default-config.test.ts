import { expect, test } from "vitest";

import { DefaultLocale } from "@/constants/application.ts";
import type { ConfigType } from "@/types/application/config.type.ts";

import { getDefaultConfig } from "./get-default-config.ts";

const testName = "Default Config: No arguments";

test(testName, async () => {
  const defaultConfig: ConfigType = {
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

  expect(
    JSON.stringify(await getDefaultConfig()),
  ).toBe(
    JSON.stringify(defaultConfig),
  );
});
