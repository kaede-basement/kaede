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

type Lifetime = { "startedAt": number; "endedAt"?: number; "instanceId"?: string };
const identity = Symbol("native process");

type NativeHandle = ProcessHandleType & { [identity]?: object };
const lifetimes = new WeakMap<object, Lifetime>;
const live = new Map<string, Lifetime>;
const recentExits = new Map<string, Lifetime>;
const recentExitLimit = 64;

type ExitListener = (payload: ExitPayload, endedAt: number) => void;
const exitListeners = new Map<string, Set<ExitListener>>;

export function addProcessExitListener(token: string, listener: ExitListener): () => void {
  const listeners = exitListeners.get(token) ?? new Set<ExitListener>;

  listeners.add(listener);
  exitListeners.set(token, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) exitListeners.delete(token);
  };
}

export function processLifetime(handle: NativeHandle): Lifetime | undefined {
  return (handle[identity] && lifetimes.get(handle[identity])) ??
    live.get(handle.token) ?? recentExits.get(handle.token);
}

export function* siblingTokens(instanceId: string, selected: string): Generator<string> {
  for (const [token, lifetime] of live) {
    if (lifetime.instanceId === instanceId && token !== selected) yield token;
  }
}

export function recordSpawnLifetime(handle: NativeHandle, startedAt: number): void {
  const instanceId = handle.kind === "minecraft" &&
    (handle.meta as { "instanceId"?: string } | null)?.instanceId;
  const lifetime = live.get(handle.token) ?? { startedAt, "instanceId": instanceId || undefined };

  bindLifetime(handle, lifetime);
  live.set(handle.token, lifetime);
}

function bindLifetime(handle: NativeHandle, lifetime: Lifetime): void {
  // An enumerable symbol preserves the identity across extension object spreads.
  const key = Object.freeze({});

  handle[identity] = key;
  lifetimes.set(key, lifetime);
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

type ExitPayload = Parameters<NonNullable<ProcessHandlersType["onExit"]>>[0] & { "token": string };
type BufferedExit = { "payload": ExitPayload; "endedAt": number; "handled": boolean };
const maxBufferedExits = 256;

type Recovery = {
  "recent"      : Map<string, BufferedExit>;
  "tracked"     : ReadonlyMap<string, (endedAt: number) => void>;
  "trackedExits": Map<string, BufferedExit>;
};
const pendingLists = new Set<Recovery>;

export function dispatchProcessExit(payload: ExitPayload): void {
  const endedAt = performance.now();
  const handlers = ProcessHandlers.get(payload.token);

  ProcessHandlers.delete(payload.token);
  const listeners = exitListeners.get(payload.token);
  const errors: Array<unknown> = [];

  for (const listener of listeners ?? []) {
    try {
      listener(payload, endedAt);
    } catch (error) {
      errors.push(error);
    }
  }
  exitListeners.delete(payload.token);
  const lifetime = live.get(payload.token) ?? recentExits.get(payload.token) ??
    { "startedAt": endedAt };

  lifetime.endedAt ??= endedAt;
  live.delete(payload.token);
  recentExits.set(payload.token, lifetime);
  if (recentExits.size > recentExitLimit) recentExits.delete(recentExits.keys().next().value!);
  if (pendingLists.size > 0) {
    const exit = { payload, endedAt, "handled": !!handlers || !!listeners };

    lifetimes.set(exit, lifetime);

    for (const { recent, tracked, trackedExits } of pendingLists) {
      if (tracked.has(payload.token)) {
        trackedExits.set(payload.token, exit);
      } else if (recent.size <= maxBufferedExits) {
        recent.set(payload.token, exit);
      }
    }
  }
  handlers?.onExit?.(payload);
  if (errors.length > 0) throw errors[0];
}

export async function rehydrateProcesses(
  attach: (handle: ProcessHandleType) => ProcessHandlersType | undefined,
  onExited?: (handle: ProcessHandleType, exit: BufferedExit) => void,
  tracked: ReadonlyMap<string, (endedAt: number) => void> = new Map,
): Promise<Array<ProcessHandleType>> {
  const recent = new Map<string, BufferedExit>;
  const trackedExits = new Map<string, BufferedExit>;
  const recovery = { recent, tracked, trackedExits };

  pendingLists.add(recovery);
  try {
    let processes: Array<ProcessDtoType>;

    do {
      recent.clear();
      processes = await invoke<Array<ProcessDtoType>>("list_processes");
    } while (recent.size > maxBufferedExits);

    const absent = new Map(tracked);

    for (const dto of processes) {
      absent.delete(dto.token);
    }
    for (const [token, finish] of absent) {
      finish(trackedExits.get(token)?.endedAt ?? performance.now());
    }

    const running = [];

    for (const dto of processes) {
      const exit = trackedExits.get(dto.token) ?? recent.get(dto.token);

      if (exit) {
        if (!exit.handled) {
          const handle = toProcessHandle(dto);

          bindLifetime(handle, lifetimes.get(exit)!);
          onExited?.(handle, exit);
        }
      } else {
        const handle = toProcessHandle(dto);

        recordSpawnLifetime(handle, performance.now());
        const handlers = attach(handle);

        if (handlers !== undefined) {
          ProcessHandlers.set(dto.token, handlers);
        }
        running.push(handle);
      }
    }

    return running;
  } finally {
    pendingLists.delete(recovery);
  }
}
