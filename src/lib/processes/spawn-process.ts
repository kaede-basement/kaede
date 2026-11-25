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

import { invoke } from "@tauri-apps/api/core";

import {
  addProcessExitListener, minecraftInstanceId, ProcessHandlers, recordSpawnLifetime,
  toProcessHandle,
} from "@/lib/processes/core.ts";
import { activeRun } from "@/states/instance-operation.ts";
import type {
  ProcessDtoType,
  ProcessHandlersType,
  ProcessHandleType,
  ProgramSpecType,
} from "@/types/application/server-process.type.ts";

type SpawnObserver = (handle: ProcessHandleType, startedAt: number) => void;
const origin = Symbol("Minecraft spawn");

type SpawnHandlers = ProcessHandlersType & { [origin]?: symbol };
type PendingSpawn = {
  "instanceId": string;
  "request"   : object;
  "handlers"  : SpawnHandlers;
  "observe"   : SpawnObserver;
};
const pendingSpawns = new Set<PendingSpawn>;

export function observeMinecraftSpawn(spawn: PendingSpawn): () => void {
  // Handler decorators commonly spread the bag and replace its callbacks.
  spawn.handlers[origin] = Symbol();
  pendingSpawns.add(spawn);

  return () => pendingSpawns.delete(spawn);
}

function takeSpawnObserver(
  instanceId: string, request: object, handlers: SpawnHandlers,
): SpawnObserver | undefined {
  for (const spawn of pendingSpawns) {
    if (spawn.instanceId !== instanceId) continue;
    // A helper may have an identical command and instanceId.
    const forwarded = request === spawn.request || handlers[origin] === spawn.handlers[origin] ||
      (handlers.onExit && handlers.onExit === spawn.handlers.onExit) ||
      (handlers.onError && handlers.onError === spawn.handlers.onError);

    if (forwarded) {
      pendingSpawns.delete(spawn);

      return spawn.observe;
    }
  }
}

// 'crypto.randomUUID()' is unavailable outside secure contexts on webkitgtk...
function createToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36)
    .slice(2)}`;
}

export async function spawnProcess<Meta>(
  options: {
    "program": ProgramSpecType;
    "args"?  : Array<string>;
    "cwd"?   : string;
    "env"?   : Record<string, string>;
    "kind"   : string;
    "meta"   : Meta;
  },
  processHandlers: ProcessHandlersType = {},
): Promise<ProcessHandleType<Meta>> {
  const token = createToken();

  const instanceId = minecraftInstanceId(options);
  const observe = instanceId && takeSpawnObserver(instanceId, options, processHandlers);
  const ownerAtRequest = instanceId && activeRun(instanceId);
  const requestedAt = performance.now();
  let confirmed: ProcessHandleType<Meta> | undefined;

  function confirm(dto: ProcessDtoType<Meta>, startedAt: number): ProcessHandleType<Meta> {
    if (!confirmed) {
      confirmed = toProcessHandle(dto);
      recordSpawnLifetime(confirmed, startedAt);
      if (instanceId) {
        const owner = ownerAtRequest || activeRun(instanceId);

        if (owner && owner.process.token !== dto.token) owner.excludeSibling?.(dto.token);
      }
      if (observe) observe(confirmed, startedAt);
    }

    return confirmed;
  }
  ProcessHandlers.set(token, processHandlers);
  const unsubscribe = addProcessExitListener(token, payload => {
    const { kind, meta } = options;

    confirm({ token, "pid": payload.pid, kind, meta }, requestedAt);
  });

  try {
    const dto = await invoke<ProcessDtoType<Meta>>("spawn_process", {
      "spec": { token, ...options },
    });

    const handle = confirm(dto, performance.now());

    unsubscribe();

    return handle;
  } catch (error) {
    unsubscribe();
    ProcessHandlers.delete(token);
    throw error;
  }
}