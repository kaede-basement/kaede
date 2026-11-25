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
  addProcessExitListener, ProcessHandlers, recordSpawnLifetime,
  toProcessHandle,
} from "@/lib/processes/core.ts";
import type {
  ProcessDtoType,
  ProcessHandlersType,
  ProcessHandleType,
  ProgramSpecType,
} from "@/types/application/server-process.type.ts";

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
      recordSpawnLifetime(confirmed, startedAt);
      onSpawn?.(confirmed, startedAt);
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