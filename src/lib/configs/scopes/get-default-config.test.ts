import { expect, test } from "vitest";

import type { ConfigType } from "@/types/application/config.type.ts";

import { getDefaultConfig } from "./get-default-config.ts";

const testName = "Default Config: No arguments";

test(testName, async () => {
  const defaultConfig: ConfigType = {
    "development": null,
    "layout"     : {
      "custom"    : false,
      "background": {
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
      "dates"      : false,
      "filtering"  : "",
    },
    "minecraft": {
      "windowHeight": 480,
      "windowWidth" : 854,
      "jvmArgs"     : "",
      "icon"        : "",
    },
    "misc": {
      "enableDiscordRPC"                 : false,
      "showAfterExtensionsInitialization": false,
    },
  };

  expect(
    JSON.stringify(await getDefaultConfig()),
  ).toBe(
    JSON.stringify(defaultConfig),
  );
});
