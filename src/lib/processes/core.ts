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

import type {
  ProcessDtoType,
  ProcessHandlersType,
  ProcessHandleType,
} from "@/types/application/server-process.type.ts";

export const ProcessHandlers = new Map<string, ProcessHandlersType>;

const pendingSnapshots = new Set<Set<string>>;

export function handleProcessExit(
  payload: Parameters<NonNullable<ProcessHandlersType["onExit"]>>[0],
): void {
  for (const exited of pendingSnapshots) {
    exited.add(payload.token);
  }
  const handlers = ProcessHandlers.get(payload.token);

  ProcessHandlers.delete(payload.token);
  handlers?.onExit?.(payload);
}

export function toProcessHandle<Meta>({
  token,
  pid,
  kind,
  meta,
}: ProcessDtoType<Meta>): ProcessHandleType<Meta> {
  return {
    token, pid, kind, meta,
    "kill" : () => invoke("kill_process", { pid }),
    "write": data => invoke("write_process", {
      pid,
      "data": typeof data === "string" ? data : [...data],
    }),
  };
}

export async function rehydrateProcesses(
  attach: (handle: ProcessHandleType) => ProcessHandlersType | undefined,
): Promise<Array<ProcessHandleType>> {
  const exited = (new Set<string>);

  pendingSnapshots.add(exited);
  try {
    const DTOs = await invoke<Array<ProcessDtoType>>("list_processes");

    return DTOs.filter(DTO => !exited.has(DTO.token)).map(DTO => {
      const handle = toProcessHandle(DTO);
      const handlers = attach(handle);

      if (handlers) {
        ProcessHandlers.set(handle.token, handlers);
      }

      return handle;
    });
  } finally {
    pendingSnapshots.delete(exited);
  }
}
