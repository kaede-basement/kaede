import { expect, test } from "vitest";

import type { ConfigType } from "@/types/application/config.type.ts";

import { getDefaultConfig } from "./get-default-config.ts";

const testName = "Default Config: No arguments";

test(testName, async () => {
  const defaultConfig: ConfigType = {
    "customization": {
      "theme"     : "dark",
      "accent"    : "rose",
      "background": "none",
    },
    "locale"               : "en",
    "minecraftWindowHeight": 480,
    "minecraftWindowWidth" : 854,
    "development"          : {
      "enableDebugMode": false,
    },
    "showBeforeInitialization": false,
  };

  expect(
    JSON.stringify(await getDefaultConfig()),
  ).toBe(
    JSON.stringify(defaultConfig),
  );
});
