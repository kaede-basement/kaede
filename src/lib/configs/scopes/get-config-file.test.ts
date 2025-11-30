import { beforeEach, expect, test, vi } from "vitest";

import type { ConfigType } from "@/types/configs/config.type.ts";

const defaultConfig: ConfigType = {
  "development": null,
  "extensions" : {
    "enabled"                   : true,
    "allowUnrestrictedUntrusted": true,
  },
  "layout": {
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
    "showAfterExtensionsInitialization": false,
    "enableDiscordRPC"                 : false,
    "autoConfigSync"                   : false,
  },
};

vi.mock("@/lib/configs/scopes/get-default-config.ts", async () => {
  return {
    "getDefaultConfig": async (): Promise<ConfigType> => defaultConfig,
  };
});
vi.mock("@/lib/configs/scopes/initialize-config-file.ts", async () => {
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
        "layout": {
          ...defaultConfig.layout,
          "apparently": "extra fields are going to pass the validation. i " +
            "spent 2 days thinking why my tests were broken xd",
        },
        "TUYU": "is awesome",
      }),
    },
    "output": {
      ...defaultConfig,
      "layout": {
        ...defaultConfig.layout,
        "apparently": "extra fields are going to pass the validation. i " +
          "spent 2 days thinking why my tests were broken xd",
      },
      "TUYU": "is awesome",
    },
  },
  {
    "arguments": {
      "exists"       : true,
      "fetchedConfig": JSON.stringify({
        ...defaultConfig,
        "layout": {

          /*
           * 'custom' field can only be a boolean
           * or an array of literals, such as "sidebar" or "contextMenu"
           */
          "custom": "blue",
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
        "minecraft": {
          // 'windowHeight' should have a 'number' type
          "windowHeight": "480",
          "windowWidth" : 854,
          "jvmArgs"     : "",
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
        "layout": {
          ...defaultConfig.layout,
          "background": {
            ...defaultConfig.layout.background,
            "url": "some-url",
          },
        },
      }),
    },
    "output": {
      ...defaultConfig,
      "layout": {
        ...defaultConfig.layout,
        "background": {
          ...defaultConfig.layout.background,
          "url": "some-url",
        },
      },
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
  vi.doMock("@/lib/general", async () => {
    return {
      "default": {
        "checkIsPortable" : async (): Promise<boolean> => false,
        "getBaseDirectory": async (): Promise<string> => "",
        "cachedJoin"      : (): string => "",
      },
    };
  });
  vi.doMock("@tauri-apps/api/path", async () => {
    return {
      "join": async (): Promise<string> => "",
    };
  });
  vi.doMock("@tauri-apps/plugin-fs", async () => {
    return {
      "BaseDirectory": {
        "AppData": 14,
      },
      "rename"      : async (): Promise<void> => {},
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
