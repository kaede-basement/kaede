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

import { Channel } from "@tauri-apps/api/core";
import { onMounted, onUnmounted, type ShallowRef, shallowRef, watch } from "vue";

import { BrowserLogBuffer } from "@/extendable/global-internals.ts";
import Browser from "@/lib/browser";
import Logging from "@/lib/logging";

type LogStreamEventType =
  | { "type": "snapshot"; "data": Array<string> }
  | { "type": "lines";    "data": Array<string> }
  | { "type": "truncated" };

let activeId: number | undefined;
let stopRunning: (() => void) | undefined;
let finished: Promise<void> = Promise.resolve();

function subscriptionId(): number {
  const [high, low] = crypto.getRandomValues(new Uint32Array(2));

  return ((high % (2 ** 21)) * (2 ** 32)) + low || 1;
}

export type LogBuffer = { "list": Array<string>; "dropped"?: number; "revision"?: number };

export function useLogStream(): {
  "lines": ShallowRef<LogBuffer>;
} {
  const isBrowser = Browser.detectIsBrowser();
  const lines = shallowRef<LogBuffer>({ "list": [] });

  if (isBrowser) {
    watch(BrowserLogBuffer, buffer => {
      lines.value = { ...buffer };
    }, { "immediate": true });

    return { lines };
  }

  const id = subscriptionId();

  async function start(): Promise<void> {
    if (id !== activeId) {
      return;
    }

    const channel = new Channel<LogStreamEventType>;
    let registered = false;
    let stopping: Promise<unknown> | undefined;

    function stop(retry = false): void {
      if (!stopping || retry) {
        stopping = Promise.all([stopping, Logging.stopStreamingLogs(id)]);
      }
    }

    stopRunning = stop;

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    channel.onmessage = (event): void => {
      if (id !== activeId) {
        // A stop sent before Rust registered the tail can miss it.
        if (!registered && stopRunning === stop) {
          registered = true;
          stop(true);
        }

        return;
      }

      registered = true;

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

    try {
      await Logging.streamLogs(channel, id);
    } finally {
      stopRunning = undefined;
      await stopping;
    }
  }

  onMounted(() => {
    activeId = id;
    stopRunning?.();
    // The legacy backend has one tail slot. Drain its stream and stops before starting another.
    finished = finished.then(start, start);

    return finished;
  });
  onUnmounted(() => {
    if (activeId === id) {
      activeId = undefined;
      stopRunning?.();
    }
  });

  return { lines };
}
