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
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export const RunStartedAt = reactive(new Map<string, number>);

/**
 * Contains all Minecraft instance states.
 */
export let instanceStates: Reactive<InstanceStatesType>;

/**
 * Assign the actual instance states to 'instanceStates'.
 * This function is called in 'main.ts'
 */
export function declareInstanceStates(): void {
  instanceStates = reactive(structuredClone(GlobalInternals.initialInstances));
}

export function startPlaytime(instanceId: string, token: string, rehydrated = false): void {
  const storageKey = `kaede.run.${instanceId}`;
  const saved = rehydrated ? localStorage.getItem(storageKey) : null;
  const launched = !rehydrated || saved?.startsWith(token + ":launched:");
  const prefix = token + (launched ? ":launched:" : ":observed:");
  const savedTime = saved?.startsWith(prefix) ? Number(saved.slice(prefix.length)) : Number.NaN;
  const startedAt = Number.isFinite(savedTime) ? savedTime : Date.now();

  if (!Number.isFinite(savedTime)) {
    localStorage.setItem(storageKey, prefix + startedAt);
  }
  RunStartedAt.set(instanceId, startedAt);
  const instance = instanceStates[instanceId];

  if (instance && launched) {
    instance.lastLaunch = startedAt;
  }
}

export function commitPlaytime(instanceId: string): void {
  const startedAt = RunStartedAt.get(instanceId);

  if (startedAt === undefined) {
    return;
  }

  RunStartedAt.delete(instanceId);
  localStorage.removeItem(`kaede.run.${instanceId}`);
  const instance = instanceStates[instanceId];

  if (instance) {
    instance.playTime += Math.max(0, Date.now() - startedAt);
  }
}
