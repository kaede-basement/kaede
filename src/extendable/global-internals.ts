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

const maximumLines = 5000;
const trimChunk = 500;

const mutators = ["push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "reverse",
  "sort",
  "fill",
  "copyWithin"] as const;

function observeLogs(values: Array<string>): {
  "list": Array<string>; "dropped": number; "detach": () => void;
} {
  const restore: Array<() => void> = [];
  const buffer = { "list"   : values, "dropped": 0, "detach" : (): void => {
    for (const undo of restore) undo();
  } };

  function trim(): void {
    if (values.length > maximumLines) {
      const count = values.length - maximumLines + trimChunk;

      Array.prototype.copyWithin.call(values, 0, count);
      values.length -= count;
      buffer.dropped += count;
    }
  }
  trim();
  let queued = false;

  function changed(): void {
    if (!queued) {
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (BrowserLogs.value === buffer) {
          trim();
          triggerRef(BrowserLogs);
        }
      });
    }
  }
  buffer.list = new Proxy(values, {
    set(target, key, value): boolean {
      const result = Reflect.set(target, key, value);

      // Array mutators commit their final length after writing the elements.
      if (key === "length") trim();
      changed();

      return result;
    },
    deleteProperty(target, key): boolean {
      changed();

      return Reflect.deleteProperty(target, key);
    },
  });

  for (const key of mutators) {
    const descriptor = Object.getOwnPropertyDescriptor(values, key);

    if (descriptor ? !descriptor.configurable : !Object.isExtensible(values)) continue;
    const original = values[key];
    const handler = { mutate(this: Array<string>, ...arguments_: Array<unknown>): unknown {
      const receiver = this === buffer.list ? values : this;
      const result = Reflect.apply(original, receiver, arguments_);

      if (receiver === values) {
        trim();
        changed();
      }

      return result === values ? this : result;
    } };

    Object.defineProperty(values, key, {
      "value": handler.mutate, "configurable": true, "writable": true,
    });
    restore.push(() => {
      if (values[key] !== handler.mutate) return;
      if (descriptor) Object.defineProperty(values, key, descriptor);
      else Reflect.deleteProperty(values, key);
    });
  }

  return buffer;
}

export const BrowserLogs = shallowRef(observeLogs([]));

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
    return BrowserLogs.value.list;
  },
  set "logsInBrowser"(values: Array<string>) {
    if (values !== BrowserLogs.value.list) {
      BrowserLogs.value.detach();
      BrowserLogs.value = observeLogs(values);
    }
  },
  "logs": {},
};
