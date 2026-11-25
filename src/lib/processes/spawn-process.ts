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
  ProcessHandlers,
  toProcessHandle,
} from "@/lib/processes/core.ts";
import type {
  ProcessDtoType,
  ProcessHandlersType,
  ProcessHandleType,
  ProgramSpecType,
} from "@/types/application/server-process.type.ts";

type Lifetime = { "startedAt": number; "endedAt"?: number };
const lifetimes = new WeakMap<ProcessHandleType, Lifetime>;

export function spawnLifetime(process: ProcessHandleType): Readonly<Lifetime> | undefined {
  return lifetimes.get(process);
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
  onSpawn?: (process: ProcessHandleType<Meta>, startedAt: number) => void,
): Promise<ProcessHandleType<Meta>> {
  const token = createToken();

  const requestedAt = performance.now();
  let confirmed: ProcessHandleType<Meta> | undefined;

  function confirm(dto: ProcessDtoType<Meta>, startedAt: number): ProcessHandleType<Meta> {
    if (!confirmed) {
      confirmed = toProcessHandle(dto);
      lifetimes.set(confirmed, { startedAt });
      onSpawn?.(confirmed, startedAt);
    }

    return confirmed;
  }
  ProcessHandlers.set(token, {
    ...processHandlers,
    "onExit": payload => {
      // An exit proves the process spawned even when its IPC reply is still pending.
      const { kind, meta } = options;

      const process = confirm({ token, "pid": payload.pid, kind, meta }, requestedAt);

      lifetimes.get(process)!.endedAt = performance.now();
      processHandlers.onExit?.(payload);
    },
  });

  try {
    const dto = await invoke<ProcessDtoType<Meta>>("spawn_process", {
      "spec": { token, ...options },
    });

    return confirm(dto, performance.now());
  } catch (error) {
    ProcessHandlers.delete(token);
    throw error;
  }
}