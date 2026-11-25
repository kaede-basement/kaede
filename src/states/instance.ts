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

import { type Reactive, reactive } from "vue";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { log } from "@/lib/logging/log.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";

import { activeRun, finishRun, operationIds, recordRun } from "./instance-operation.ts";

type ActiveCheckpoint = {
  "token"       : string;
  "savedAt"     : number;
  "carriedMs"   : number;
  "basePlayTime": number;
  "lastLaunch"  : number;
};
type FinishedCheckpoint = { "token": string; "playTime": number; "lastLaunch": number };
type RestoredRun = { "id": string; "checkpoint": ActiveCheckpoint; "startedAt": number };

const pending = new Map<string, FinishedCheckpoint>;
const restored = new Map<string, RestoredRun>;

function storage<T>(action: (store: Storage) => T): T | undefined {
  try {
    return action(localStorage);
  } catch (error) {
    log.warn(__PRE_BUNDLED_FILENAME__, "Playtime checkpoint unavailable:", String(error));
  }
}

function prefix(kind: "active" | "finished"): string {
  return `kaede.playtime:${encodeURIComponent(GlobalInternals.baseDirectory)}:${kind}.`;
}

export let instanceStates: Reactive<InstanceStatesType>;

export function declareInstanceStates(): () => void {
  const previous = instanceStates;

  instanceStates = reactive(structuredClone(GlobalInternals.initialInstances));

  return () => {
    instanceStates = previous;
  };
}

function applyFinished(id: string, checkpoint: FinishedCheckpoint): void {
  const instance = instanceStates[id];

  if (instance && instance.playTime <= checkpoint.playTime) {
    instance.playTime = checkpoint.playTime;
    instance.lastLaunch = checkpoint.lastLaunch;
  }
  pending.set(id, checkpoint);
}

function restoreCheckpoint(store: Storage, key: string, id: string, active: boolean): void {
  const value = store.getItem(key);

  if (value === null) {
    return;
  }
  const checkpoint = JSON.parse(value);

  if (typeof checkpoint?.token !== "string" || !Number.isFinite(checkpoint.lastLaunch)) {
    throw new TypeError(`Invalid playtime checkpoint for ${id}`);
  }
  if (active) {
    const { savedAt, carriedMs, basePlayTime } = checkpoint;

    if (![savedAt, carriedMs, basePlayTime].every(value => Number.isFinite(value))) {
      throw new TypeError(`Invalid active checkpoint for ${id}`);
    }
    const elapsed = carriedMs + Math.max(0, Date.now() - savedAt);

    restored.set(checkpoint.token, { id, checkpoint, "startedAt": performance.now() - elapsed });
  } else {
    if (!Number.isFinite(checkpoint.playTime)) {
      throw new TypeError(`Invalid finished checkpoint for ${id}`);
    }
    applyFinished(id, checkpoint);
  }
}

export function restorePlaytime(): boolean {
  restored.clear();
  const activePrefix = prefix("active");
  const finishedPrefix = prefix("finished");

  storage(store => {
    for (let index = 0; index < store.length; index++) {
      const key = store.key(index);

      if (key?.startsWith(activePrefix)) {
        storage(store => restoreCheckpoint(store, key, key.slice(activePrefix.length), true));
      } else if (key?.startsWith(finishedPrefix)) {
        storage(store => restoreCheckpoint(store, key, key.slice(finishedPrefix.length), false));
      }
    }
  });
  for (const checkpoint of pending.values()) {
    restored.delete(checkpoint.token);
  }

  return pending.size > 0;
}

function saveActive(id: string): void {
  const run = activeRun(id);
  const instance = instanceStates[id];

  if (!run || !instance) {
    return;
  }
  const checkpoint: ActiveCheckpoint = {
    "token"       : run.process.token,
    "savedAt"     : Date.now(),
    "carriedMs"   : Math.max(0, performance.now() - run.startedAt),
    "basePlayTime": instance.playTime,
    "lastLaunch"  : instance.lastLaunch,
  };

  storage(store => store.setItem(prefix("active") + id, JSON.stringify(checkpoint)));
}

export function checkpointActivePlaytime(): void {
  for (const id of operationIds()) {
    saveActive(id);
  }
}

export function startPlaytime(
  id: string,
  process: MinecraftProcessType,
  rehydrated = false,
  startedAt = performance.now(),
): boolean {
  const previous = rehydrated ? restored.get(process.token) : undefined;

  if (!recordRun(id, process, previous?.startedAt ?? startedAt, rehydrated)) return false;
  restored.delete(process.token);
  const instance = instanceStates[id];

  if (instance && previous) {
    instance.playTime = Math.max(instance.playTime, previous.checkpoint.basePlayTime);
    instance.lastLaunch = previous.checkpoint.lastLaunch;
  } else if (instance && !rehydrated) {
    instance.lastLaunch = Date.now() - Math.max(0, Math.floor(performance.now() - startedAt));
  }
  saveActive(id);

  return true;
}

function finish(id: string, checkpoint: FinishedCheckpoint): void {
  applyFinished(id, checkpoint);
  storage(store => store.setItem(prefix("finished") + id, JSON.stringify(checkpoint)));
}

export function missingRunHandlers(): Map<string, (endedAt: number) => void> {
  const handlers = new Map<string, (endedAt: number) => void>;

  for (const [token, { id, checkpoint, startedAt }] of restored) {
    handlers.set(token, endedAt => {
      if (!restored.delete(token)) {
        return;
      }
      finish(id, {
        token,
        "playTime"  : checkpoint.basePlayTime + Math.max(0, Math.floor(endedAt - startedAt)),
        "lastLaunch": checkpoint.lastLaunch,
      });
    });
  }

  return handlers;
}

export function commitPlaytime(id: string, token: string, endedAt: number): void {
  const run = activeRun(id);

  if (run?.process.token !== token) {
    return;
  }
  finishRun(id, token);
  const instance = instanceStates[id];

  finish(id, {
    token,
    "playTime"  : (instance?.playTime ?? 0) + Math.max(0, Math.floor(endedAt - run.startedAt)),
    "lastLaunch": instance?.lastLaunch ?? 0,
  });
}

export async function flushPlaytime(write: () => Promise<void>): Promise<void> {
  if (pending.size === 0) {
    return write();
  }
  const checkpoints = new Map(pending);

  await write();
  for (const [id, saved] of checkpoints) {
    if (pending.get(id) !== saved) {
      continue;
    }
    const cleaned = storage(store => {
      for (const kind of ["active", "finished"] as const) {
        const key = prefix(kind) + id;
        const value = store.getItem(key);

        if (value && JSON.parse(value).token === saved.token) {
          store.removeItem(key);
        }
      }

      return true;
    });

    if (cleaned) {
      pending.delete(id);
    }
  }
}
