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

import { type Reactive, reactive, shallowReactive } from "vue";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";

export const ActiveRuns = shallowReactive(new Map<string, {
  "process"  : MinecraftProcessType;
  "startedAt": number;
}>);
const pending = new Map<string, string>;

function storagePrefix(): string {
  return `kaede.playtime:${encodeURIComponent(GlobalInternals.baseDirectory)}:`;
}

export let instanceStates: Reactive<InstanceStatesType>;

export function declareInstanceStates(): void {
  instanceStates = reactive(structuredClone(GlobalInternals.initialInstances));
}

export function restoreFinishedPlaytime(): boolean {
  const prefix = storagePrefix() + "finished.";

  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);

    if (!key?.startsWith(prefix)) {
      continue;
    }
    const id = key.slice(prefix.length);
    const stored = localStorage.getItem(key);

    if (stored === null) {
      continue;
    }
    const { token, playTime, lastLaunch } = JSON.parse(stored);

    if (typeof token !== "string" || !Number.isFinite(playTime) || !Number.isFinite(lastLaunch)) {
      throw new TypeError(`Invalid playtime checkpoint for ${id}`);
    }
    const instance = instanceStates[id];

    if (instance) {
      instance.playTime = Math.max(instance.playTime, playTime);
      instance.lastLaunch = lastLaunch;
    }
    pending.set(id, stored);
  }

  return pending.size > 0;
}

export function startPlaytime(
  instanceId: string,
  process: MinecraftProcessType,
  rehydrated = false,
): void {
  const { token } = process;
  const storageKey = storagePrefix() + "active." + instanceId;
  const saved = rehydrated ? localStorage.getItem(storageKey) : null;
  const launched = !rehydrated || saved?.startsWith(token + ":launched:");
  const prefix = token + (launched ? ":launched:" : ":observed:");
  const savedTime = saved?.startsWith(prefix) ? Number(saved.slice(prefix.length)) : Number.NaN;
  const wallNow = Date.now();
  const wallStart = Number.isFinite(savedTime) ? savedTime : wallNow;

  if (!Number.isFinite(savedTime)) {
    localStorage.setItem(storageKey, prefix + wallStart);
  }
  ActiveRuns.set(instanceId, {
    process,
    "startedAt": performance.now() - Math.max(0, wallNow - wallStart),
  });
  const instance = instanceStates[instanceId];

  if (instance && launched) {
    instance.lastLaunch = wallStart;
  }
}

export function commitPlaytime(instanceId: string, token: string, endedAt: number): void {
  const run = ActiveRuns.get(instanceId);

  if (run?.process.token !== token) {
    return;
  }

  const instance = instanceStates[instanceId];
  const playTime = (instance?.playTime ?? 0) + Math.max(0, Math.floor(endedAt - run.startedAt));
  const stored = JSON.stringify({ token, playTime, "lastLaunch": instance?.lastLaunch ?? 0 });

  localStorage.setItem(storagePrefix() + "finished." + instanceId, stored);
  pending.set(instanceId, stored);
  if (instance) {
    instance.playTime = playTime;
  }
  ActiveRuns.delete(instanceId);
}

export async function flushPlaytime(write: () => Promise<void>): Promise<void> {
  if (pending.size === 0) {
    return write();
  }
  const checkpoints = new Map(pending);

  await write();
  for (const [id, stored] of checkpoints) {
    const prefix = storagePrefix();
    const finished = prefix + "finished." + id;

    if (pending.get(id) !== stored) {
      continue;
    }
    pending.delete(id);
    if (localStorage.getItem(finished) !== stored) {
      continue;
    }
    const active = prefix + "active." + id;

    if (localStorage.getItem(active)?.startsWith(JSON.parse(stored).token + ":")) {
      localStorage.removeItem(active);
    }
    localStorage.removeItem(finished);
  }
}
