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

import { shallowRef, triggerRef } from "vue";

import type { KaedeNamespaceType } from "@/declarations.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

// Appends preserve indexed rows. Edits to a published prefix invalidate them.
function observeBrowserLogs(values: Array<string>): Array<string> {
  const list: Array<string> = new Proxy(values, {
    set(target, key, value): boolean {
      const oldLength = target.length;
      const previous = Reflect.get(target, key);
      const changed = Reflect.set(target, key, value);

      if (changed && previous !== value && BrowserLogBuffer.value.list === list) {
        if (target.length <= oldLength) {
          BrowserLogBuffer.value.revision++;
        }

        triggerRef(BrowserLogBuffer);
      }

      return changed;
    },
    deleteProperty(target, key): boolean {
      const existed = Reflect.has(target, key);
      const deleted = Reflect.deleteProperty(target, key);

      if (deleted && existed && BrowserLogBuffer.value.list === list) {
        BrowserLogBuffer.value.revision++;
        triggerRef(BrowserLogBuffer);
      }

      return deleted;
    },
  });

  return list;
}

export const BrowserLogBuffer = shallowRef({ "list": observeBrowserLogs([]), "revision": 0 });

export const GlobalInternals: KaedeNamespaceType["internals"] = {

  /* All these fields will be overwritten */
  "webViewRecreation": {
    "url"      : "/",
    "title"    : "Kaede",
    "width"    : 800,
    "height"   : 600,
    "visible"  : false,
    "resizable": true,
  },
  "requestPermissions" : async (): Promise<Array<unknown>> => [],
  "joinDelimiter"      : "",
  "launcherVersion"    : "",
  "executableHash"     : "",
  "initialConfig"      : {} as ConfigType,
  "initialTranslations": {} as TranslationsType,
  "initialInstances"   : {} as InstanceStatesType,
  "portable"           : false,
  "baseDirectory"      : "",
  "launchCount"        : 0,
  get "logsInBrowser"(): Array<string> {
    return BrowserLogBuffer.value.list;
  },
  set "logsInBrowser"(values: Array<string>) {
    if (values !== BrowserLogBuffer.value.list) {
      BrowserLogBuffer.value = { "list": observeBrowserLogs(values), "revision": 0 };
    }
  },
  "logs": {},
};
