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

import { Channel, invoke } from "@tauri-apps/api/core";
import { onMounted, onUnmounted, type ShallowRef, shallowRef, watch } from "vue";

import { BrowserLogs } from "@/extendable/global-internals.ts";
import Browser from "@/lib/browser";
import Logging from "@/lib/logging";

type LogStreamEventType =
  | { "type": "snapshot"; "data": Array<string> }
  | { "type": "lines";    "data": Array<string> }
  | { "type": "truncated" };

let lastLegacyId = 0;

export function useLogStream(): {
  "lines": ShallowRef<{ "list": Array<string>; "dropped"?: number }>;
} {
  const isBrowser = Browser.detectIsBrowser();
  const lines = shallowRef<{ "list": Array<string>; "dropped"?: number }>({ "list": [] });

  if (isBrowser) {
    watch(BrowserLogs, buffer => {
      lines.value = { ...buffer };
    }, { "immediate": true });

    return { lines };
  }

  let mounted = false;
  let token: number | undefined;
  let subscriptionId: number | undefined;

  onMounted(async (): Promise<void> => {
    mounted = true;
    const id = await invoke<number | undefined>("next_log_subscription_id");

    if (!mounted) {
      if (typeof id === "number") {
        await Logging.stopStreamingLogs(undefined, id);
      }

      return;
    }
    if (typeof id === "number") {
      token = id;
    } else {
      subscriptionId = ++lastLegacyId;
    }
    const channel = new Channel<LogStreamEventType>;

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    channel.onmessage = (event): void => {
      switch (event.type) {
        case "snapshot": {
          lines.value = { "list": event.data };

          break;
        }
        case "lines": {
          for (const line of event.data) {
            lines.value.list.push(line);
          }

          lines.value = { "list": lines.value.list };

          break;
        }
        case "truncated": {
          lines.value = { "list": [] };

          break;
        }
      }
    };

    await Logging.streamLogs<LogStreamEventType>(channel, subscriptionId, token);
  });

  onUnmounted(async (): Promise<void> => {
    mounted = false;
    if (token !== undefined || subscriptionId !== undefined) {
      await Logging.stopStreamingLogs(subscriptionId, token);
    }
  });

  return { lines };
}
