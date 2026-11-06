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

import { bench, type k_iter, type k_state, run, summary } from "mitata";

import { CheckConfig } from "./validators.ts";

summary(async (): Promise<void> => {
  bench("CheckConfig() for $input", function* (state: k_iter & k_state) {
    const current = state.get("input");

    yield {
      [0](): unknown {
        return current;
      },
      bench(current: unknown): void {
        CheckConfig(current);
      },
    };
  }).args("input", [
    undefined,
    0,
    [],
    {
      "development": {
        "loadErudaDevTools"         : false,
        "showFPS"                   : false,
        "showCPUUsage"              : false,
        "showMemoryUsage"           : false,
        "enableDebugMode"           : false,
        "enableNativeContextMenu"   : false,
        "enableNativeReloadKeyBinds": false,
        "useNativeColorPicker"      : false,
      },
      "extensions": {
        "list"                      : [],
        "permissions"               : {},
        "enabled"                   : false,
        "allowUnrestrictedUntrusted": false,
        "showAppAfterExtensionsLoad": false,
      },
      "ui": {
        "ripple": {
          "color"   : "#ffffff15",
          "sparkles": "255 255 255",
        },
        "background": {
          "image"  : null,
          "blur"   : null,
          "color"  : null,
          "isVideo": null,
          "key"    : null,
        },
        "text": {
          "font"          : null,
          "mainColor"     : null,
          "secondaryColor": null,
        },
        "widget": {
          "blur"          : null,
          "textColor"     : null,
          "secondaryColor": null,
          "background"    : null,
        },
        "atAGlance": [
          {
            "title"   : "Welcome~",
            "subtitle": "you can change this text",
          },
          {
            "title"   : "These messages",
            "subtitle": "were inspired by the \"At a Glance\" Android widget",
          },
          {
            "title"   : "%date%",
            "subtitle": "What a great day to play Minecraft, right?",
          },
        ],
      },
      "selected": {
        "account"        : 0,
        "currentInstance": null,
        "stats"          : "playtime",
      },
      "locale": "placeholder",
      "logs"  : {
        "show"      : false,
        "mode"      : "kaede-launcher",
        "filtering" : "",
        "lineHeight": 20,
        "partsShown": { "time": true, "level": true, "target": true, "message": true },
        "partsSize" : { "time": 12, "level": 5, "target": 32 },
      },
      "java"     : [],
      "minecraft": {
        "windowHeight": 480,
        "windowWidth" : 854,
        "icon"        : "placeholder",
        "javaBinary"  : "java",
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
  ]);
});

await run();
