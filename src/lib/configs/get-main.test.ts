/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { expect, mock, test } from "bun:test";

import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

const defaultConfig: ConfigType = await getDefaultConfig();

// 'handleJsonFile' returns the actually stored config; reassigned by every test case
let currentFetchedConfig: unknown;

/*
 * Unlike 'vi.mock', 'mock.module' is not hoisted, so it only has to be registered
 * before the dynamic import of the module under test. The factory closures read
 * 'currentFetchedConfig' at call time, which replaces the old 'vi.doMock' dance.
 *
 * Note: 'bun test' runs all test files in a single process with a shared module
 * registry, so these mocks leak into test files that run later. Tests that import
 * concrete scope files instead of the '@/lib/...' barrels stay unaffected.
 */
mock.module("@/lib/hooks", () => ({
  "default": {
    "catchAsyncResponseHooks": async (): Promise<string> => "continue",
  },
}));
mock.module("@/lib/file-manager", () => ({
  "default": {
    "handleJsonFile"  : async (): Promise<unknown> => currentFetchedConfig,
    "join"            : (): string => "",
    "getBaseDirectory": (): string => "",
  },
}));
mock.module("@/lib/configs/scopes/regenerate-config-file.ts", () => ({
  // 'regenerateConfigFile' returns a default config
  "regenerateConfigFile": async (): Promise<unknown> => defaultConfig,
}));

const testData: Array<{
  "label"    : string;
  "arguments": {
    "fetchedConfig": unknown;
  };
  "output": unknown;
}> = [
  {
    "label"    : "Empty Object",
    "arguments": {
      "fetchedConfig": {},
    },
    "output": defaultConfig,
  },
  {
    "label"    : "Extra Fields",
    "arguments": {
      "fetchedConfig": {
        ...defaultConfig,
        "ui": {
          ...defaultConfig.ui,
          "apparently": "extra fields are going to pass the validation. i " +
            "spent 2 days thinking why my tests were broken xd",
        },
        "TUYU": "is awesome",
      },
    },
    "output": {
      ...defaultConfig,
      "ui": {
        ...defaultConfig.ui,
        "apparently": "extra fields are going to pass the validation. i " +
          "spent 2 days thinking why my tests were broken xd",
      },
      "TUYU": "is awesome",
    },
  },
  {
    "label"    : "Number as a String",
    "arguments": {
      "fetchedConfig": {
        ...defaultConfig,
        "minecraft": {
          // 'windowHeight' should have a 'number' type
          "windowHeight": "480",
          "windowWidth" : 854,
          "add"         : {
            "jvmArguments" : [],
            "gameArguments": [],
          },
          "remove": {
            "jvmArguments" : [],
            "gameArguments": [],
          },
        },
      },
    },
    "output": defaultConfig,
  },
  {
    "label"    : "Different 'ui.background.image' Value",
    "arguments": {
      "fetchedConfig": {
        ...defaultConfig,
        "ui": {
          ...defaultConfig.ui,
          "background": {
            ...defaultConfig.ui.background,
            "image": "some-url",
          },
        },
      },
    },
    "output": {
      ...defaultConfig,
      "ui": {
        ...defaultConfig.ui,
        "background": {
          ...defaultConfig.ui.background,
          "image": "some-url",
        },
      },
    },
  },
  {
    "label"    : "Non-object (0)",
    "arguments": {
      "fetchedConfig": 0,
    },
    "output": defaultConfig,
  },
  {
    "label"    : "Non-object (\"\")",
    "arguments": {
      "fetchedConfig": "",
    },
    "output": defaultConfig,
  },
];

for (const { label, "arguments": testArguments, output } of testData) {
  const testName = `Get Config File: ${label}`;

  // Imported dynamically so that the 'mock.module' calls above are registered first
  const { getMain } = await import("./get-main.ts");

  test(testName, async () => {
    currentFetchedConfig = testArguments.fetchedConfig;

    // These 'expect' tests throw an error on test fail which completely destroys next tests
    expect(
      JSON.stringify(await getMain()),
    ).toBe(
      JSON.stringify(output),
    );
  });
}
