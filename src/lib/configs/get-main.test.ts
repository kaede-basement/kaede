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

import { expect, test } from "bun:test";

import { GlobalObject } from "@/extendable/global-object.ts";
import { getMain } from "@/lib/configs/get-main.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";

const defaults = await getDefaultConfig();

for (const invalid of [null, 0, "", {}, {
  ...defaults,
  "minecraft": { ...defaults.minecraft, "windowHeight": "480" },
}]) {
  test(`Regenerate invalid config (${typeof invalid})`, async () => {
    expect(await getMain({
      "baseDirectory": "/kaede",
      "parsedFile"   : { "status": "loaded", "data": invalid },
    }, getDefaultConfig)).toStrictEqual(defaults);
  });
}

test("Read customized config and extension fields", async () => {
  const config = {
    ...defaults,
    "config/example": true,
    "ui"            : {
      ...defaults.ui,
      "background": { ...defaults.ui.background, "image": "some-url" },
    },
  };

  expect(await getMain({
    "baseDirectory": "/kaede",
    "parsedFile"   : { "status": "loaded", "data": config },
  })).toStrictEqual(config);
});

test("After hooks receive the validated config and can replace it", async () => {
  const replacement = { ...defaults, "locale": "test" };
  const hooks = GlobalObject.hooks.onConfigFileGet.after;

  hooks.push(async input => {
    expect(input).toBe(defaults);

    return { "status": "stop", "response": replacement };
  });
  try {
    expect(await getMain({
      "parsedFile": { "status": "loaded", "data": defaults },
    })).toBe(replacement);
  } finally {
    hooks.pop();
  }
});
