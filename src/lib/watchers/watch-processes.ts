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

import { listen } from "@tauri-apps/api/event";

import { log } from "@/lib/logging/log.ts";
import { dispatchProcessExit, ProcessHandlers } from "@/lib/processes/core.ts";

type StopWatching = () => Promise<void>;
let watchingPromise: Promise<StopWatching> | undefined;
let retryCleanup: StopWatching | undefined;

export function watchProcesses(): Promise<StopWatching> {
  watchingPromise ??= attachListeners().catch(error => {
    watchingPromise = undefined;
    throw error;
  });

  return watchingPromise;
}

async function attachListeners(): Promise<StopWatching> {
  const previous = retryCleanup;

  if (previous) {
    await previous();
    if (retryCleanup === previous) {
      throw new Error("Previous process listeners are still attached");
    }
  }
  const listeners = await Promise.allSettled([
    listen<
      { "token": string; "pid": number; "stream": "stdout" | "stderr"; "lines": Array<string> }
    >(
      "process-output",
      ({ payload }) => (
        ProcessHandlers.get(payload.token)?.onOutput?.(payload.lines, payload.stream)
      ),
    ),
    listen<{
      "token" : string;
      "pid"   : number;
      "kind"  : string;
      "code"  : number | null;
      "signal": number | null;
    }>(
      "process-exited",
      ({ payload }) => {
        dispatchProcessExit(payload);
      },
    ),
    listen<{ "token": string; "pid": number; "message": string }>(
      "process-error",
      ({ payload }) => ProcessHandlers.get(payload.token)?.onError?.(payload),
    ),
  ]);

  const owned = new Set(listeners.flatMap(listener => (
    listener.status === "fulfilled" ? [listener.value] : []
  )));
  let stopping: Promise<void> | undefined;

  async function release(): Promise<void> {
    await Promise.all([...owned].map(async unlisten => {
      try {
        await unlisten();
        owned.delete(unlisten);
      } catch (error) {
        log.error(__PRE_BUNDLED_FILENAME__, "Failed to detach process listener:", String(error));
      }
    }));
    if (owned.size === 0 && retryCleanup === stop) {
      retryCleanup = undefined;
    }
  }
  function stop(): Promise<void> {
    if (owned.size === 0) {
      return Promise.resolve();
    }
    if (retryCleanup !== stop) {
      retryCleanup = stop;
      watchingPromise = undefined;
    }
    stopping ??= release().finally(() => {
      stopping = undefined;
    });

    return stopping;
  }
  const failed = listeners.find(listener => listener.status === "rejected");

  if (failed) {
    retryCleanup = stop;
    await stop();
    if (owned.size === 0) {
      retryCleanup = undefined;
    }
    throw failed.reason;
  }

  return stop;
}
