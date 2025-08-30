import { beforeEach, expect, test, vi } from "vitest";
import type { ConfigType } from "@/types/config/config.schema.ts";

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

vi.mock("@/lib/handlers/log.ts", async () => {
  return await vi.importActual("@/__mocks__/log.cjs");
});
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
        "TUYU": "is awesome",
      }),
    },
    "output": defaultConfig,
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
        "__do_not_touch_VERSION": -1,
        "customization"         : {
          "theme"     : "light",
          "accent"    : "red",
          "background": "some-url",
        },
      }),
    },
    "output": {
      "__do_not_touch_VERSION": -1,
      "customization"         : {
        "theme"     : "light",
        "accent"    : "red",
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
let currentTestBeforeEach = tests[index];

beforeEach(() => {
  vi.doMock("@tauri-apps/plugin-fs", async () => {
    return {
      "BaseDirectory": {
        "AppData": 14,
      },
      "exists"      : async (): Promise<boolean> => currentTestBeforeEach.arguments.exists,
      "readTextFile": async (): Promise<string> => {
        console.log(index, tests[index], currentTestBeforeEach);

        return currentTestBeforeEach.arguments.fetchedConfig;
      },
    };
  });

  return () => {
    index++;
    currentTestBeforeEach = tests[index];
  };
});

for (const currentTest of tests) {
  const testName = `Get Config File: ${JSON.stringify(currentTest.arguments)}`;

  test(testName, async () => {
    /*
     * Original import (top-level) will not be mocked, because 'vi.doMock' is evaluated
     * after all imports and 'vi.mock' can't be called dynamically
     */
    const { getConfigFile } = await import("./get-config-file.ts");

    expect(
      JSON.stringify(await getConfigFile()),
    ).toBe(
      JSON.stringify(currentTest.output),
    );
  });
}
