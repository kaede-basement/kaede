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
import { markRaw, reactive, ref, watch } from "vue";

import {
  ActionKeys,
  ContextMenuItems,
  DefaultGlobalStatesPagesStates,
} from "@/constants/application.ts";
import EnglishTranslations from "@/constants/english.json";
import { Routes, SidebarRouteGroupItems } from "@/constants/routes.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const dirtyMarker = ref<number>(0);
const counter = ref<number>(0);

function none(): void {
  counter.value++;
}

const DefaultConfig = await getDefaultConfig();
const States = {
  "UseDeepWatcher"          : 1,
  "UseDirtyMarker"          : 2,
  "UseDeepWatcherWithChange": 3,
  "UseDirtyMarkerWithChange": 4,
} as const;

summary((): void => {
  bench("Config sync technique $kind", function* (state: k_iter & k_state) {
    const current = state.get("kind");

    yield {
      [0](): GlobalStatesType {
        return reactive({
          ...structuredClone(DefaultConfig),
          "contextMenuItems": markRaw(ContextMenuItems),
          "currentPage"     : "none",
          "translations"    : markRaw(EnglishTranslations),
          "pages"           : DefaultGlobalStatesPagesStates,
          "sidebarItems"    : markRaw([
            ...SidebarRouteGroupItems.map(item => {
              return {
                "path"  : item.Path,
                "icon"  : item.Icon,
                "name"  : item.Path,
                "action": ActionKeys.SidebarRouteChange,
              };
            }),
            "divider",
            {
              "path"  : Routes.AddInstance,
              "icon"  : "i-lucide-plus",
              "name"  : Routes.AddInstance,
              "action": ActionKeys.SidebarRouteChange,
            },
          ]),
        });
      },
      bench(localStates: GlobalStatesType): void {
        switch (current) {
          case States.UseDeepWatcherWithChange:
          case States.UseDeepWatcher: {
            const unwatcher = watch(
              // Only watch config-related fields
              () => [
                localStates.development,
                localStates.extensions,
                localStates.ui,
                localStates.selected,
                localStates.locale,
                localStates.logs,
                localStates.minecraft,
                // Also watch extension-added config-related fields
                ...Object
                  .keys(localStates)
                  .filter(key => key.startsWith("config/"))
                  .map(key => (
                    localStates[key as keyof GlobalStatesType]
                  )),
              ],
              none,
              { "deep": true, "flush": "sync" },
            );

            if (current === States.UseDeepWatcherWithChange) {
              localStates.development.showMemoryUsage = true;
            }

            unwatcher();
            break;
          }
          case States.UseDirtyMarkerWithChange:
          case States.UseDirtyMarker: {
            const unwatcher = watch(dirtyMarker, none, { "flush": "sync" });

            if (current === States.UseDirtyMarkerWithChange) {
              dirtyMarker.value++;
            }

            unwatcher();
            break;
          }
        }
      },
    };
  }).args("kind", [
    States.UseDeepWatcher,
    States.UseDirtyMarker,
    States.UseDeepWatcherWithChange,
    States.UseDirtyMarkerWithChange,
  ]);
});

await run();
