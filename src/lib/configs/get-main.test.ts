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

import { expect, spyOn, test } from "bun:test";

import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import * as regeneration from "@/lib/configs/scopes/regenerate-config-file.ts";
import FileManager from "@/lib/file-manager";
import type { ConfigType } from "@/types/configs/config.type.ts";

import { getMain } from "./get-main.ts";

const defaultConfig: ConfigType = await getDefaultConfig();

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

  test(testName, async () => {
    using read = spyOn(FileManager, "handleJsonFile")
      .mockResolvedValue(testArguments.fetchedConfig);
    using regenerate = spyOn(regeneration, "regenerateConfigFile").mockResolvedValue(defaultConfig);

    expect<unknown>(await getMain()).toEqual(output);
    expect(read).toHaveBeenCalledTimes(1);
    expect(regenerate.mock.calls.length).toBeLessThanOrEqual(1);
  });
}
