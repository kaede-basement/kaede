import { beforeEach, expect, test, vi } from "vitest";

import type { ConfigType } from "@/lib/schemas/config/config.schema.ts";

const defaultConfig: ConfigType = {
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

vi.mock("@/lib/main/get-default-config.ts", async () => {
  return {
    "getDefaultConfig": async (): Promise<ConfigType> => defaultConfig,
  };
});
vi.mock("@/lib/main/initialize-config-file.ts", async () => {
  return {
    "initializeConfigFile": async (): Promise<void> => {},
  };
});

const tests: Array<{
  "arguments": {
    "exists"       : boolean;
    "fetchedConfig": string;
  };
  "output": unknown;
}> = [
  {
    "arguments": {
      "exists"       : true,
      "fetchedConfig": JSON.stringify({}),
    },
    "output": defaultConfig,
  },
  {
    "arguments": {
      "exists"       : true,
      "fetchedConfig": JSON.stringify({
        ...defaultConfig,
        "customization": {
          ...defaultConfig.customization,
          "apparently": "extra fields are going to pass the validation. i " +
            "spent 2 days thinking my tests were broken xd",
        },
        "TUYU": "is awesome",
      }),
    },
    "output": {
      "__do_not_touch_VERSION": 1,
      "customization"         : {
        "theme"     : "dark",
        "accent"    : "rose",
        "background": "none",
        "apparently": "extra fields are going to pass the validation. i " +
          "spent 2 days thinking my tests were broken xd",
      },
      "locale"               : "system",
      "minecraftWindowHeight": 480,
      "minecraftWindowWidth" : 854,
      "TUYU"                 : "is awesome",
    },
  },
  {
    "arguments": {
      "exists"       : true,
      "fetchedConfig": JSON.stringify({
        ...defaultConfig,
        "__do_not_touch_VERSION": "-1",
        "customization"         : {
          "theme": "blue",
        },
      }),
    },
    "output": defaultConfig,
  },
  {
    "arguments": {
      "exists"       : true,
      "fetchedConfig": JSON.stringify({
        ...defaultConfig,
        "__do_not_touch_VERSION": -1,
        "customization"         : {
          "theme"     : "light",
          "accent"    : "red",
          "background": "some-url",
          "nyaa"      : "si",
        },
        "locale"                : 2,
        "minecraftWindowHeight" : "480",
        "minecraftWindowHeight ": 500,
      }),
    },
    "output": defaultConfig,
  },
  {
    "arguments": {
      "exists"       : true,
      "fetchedConfig": JSON.stringify({
        ...defaultConfig,
        "__do_not_touch_VERSION": 2,
        "customization"         : {
          ...defaultConfig.customization,
          "background": "some-url",
        },
      }),
    },
    "output": {
      "__do_not_touch_VERSION": 2,
      "customization"         : {
        "theme"     : "dark",
        "accent"    : "rose",
        "background": "some-url",
      },
      "locale"               : "system",
      "minecraftWindowHeight": 480,
      "minecraftWindowWidth" : 854,
    },
  },
  {
    "arguments": {
      "exists"       : true,
      "fetchedConfig": "0",
    },
    "output": defaultConfig,
  },
  {
    "arguments": {
      "exists"       : false,
      // If 'exists' were 'true', it would throw an error (expected behaviour)
      "fetchedConfig": "",
    },
    "output": defaultConfig,
  },
];

let index = 0;

beforeEach(() => {
  vi.doMock("@tauri-apps/plugin-fs", async () => {
    return {
      "BaseDirectory": {
        "AppData": 14,
      },
      "exists"      : async (): Promise<boolean> => tests[index].arguments.exists,
      "readTextFile": async (): Promise<string> => tests[index].arguments.fetchedConfig,
    };
  });
});

test.for(tests)(
  "Get Config File: %o", async ({ output }) => {
    /*
     * Original import (top-level) will not be mocked, because 'vi.doMock' is evaluated
     * after all imports and 'vi.mock' can't be called dynamically
     */
    const { getConfigFile } = await import("./get-config-file.ts");

    expect(
      JSON.stringify(await getConfigFile()),
    ).toBe(
      JSON.stringify(output),
    );

    index++;
  },
);
