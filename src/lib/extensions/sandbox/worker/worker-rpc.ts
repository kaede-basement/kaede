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

import type { SandboxMessage } from "@/lib/extensions/sandbox/protocol.ts";

export type WorkerRpcType = {
  "call"          : (method: string, parameters: unknown) => Promise<unknown>;
  "notify"        : (method: string, parameters: unknown) => void;
  // Handles a message from the launcher
  "receive"       : (message: SandboxMessage) => void;
  "onRequest"     : (method: string, handler: (parameters: unknown) => unknown) => void;
  "onNotification": (method: string, handler: (parameters: unknown) => void) => void;
};

export function describeError(error: unknown): string {
  try {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } catch {
    return "Unknown error";
  }
}

/**
 * The worker side of the launcher protocol.
 *
 * @param send - posts a message to the launcher through the captured port
 * @returns functions to call the launcher and to answer its calls
 */
export function createWorkerRpc(send: (message: SandboxMessage) => void): WorkerRpcType {
  const pending = (new Map<number, {
    "resolve": (value: unknown) => void;
    "reject" : (error: Error) => void;
  }>);
  const requestHandlers = (new Map<string, (parameters: unknown) => unknown>);
  const notificationHandlers = (new Map<string, (parameters: unknown) => void>);
  let nextId: number = 1;

  const answer = async (id: number, method: string, parameters: unknown): Promise<void> => {
    try {
      const handler = requestHandlers.get(method);

      if (handler === undefined) {
        throw new Error(`Unknown method '${method}'`);
      }

      send({ "kind": "response", id, "ok": true, "value": await handler(parameters) });
    } catch (error: unknown) {
      send({ "kind": "response", id, "ok": false, "error": describeError(error) });
    }
  };

  return {
    "call": (method, parameters) => new Promise((resolve, reject) => {
      const id: number = nextId++;

      pending.set(id, { resolve, reject });

      try {
        send({ "kind": "request", id, method, parameters });
      } catch (error: unknown) {
        pending.delete(id);
        reject(error);
      }
    }),
    "notify" : (method, parameters) => send({ "kind": "notify", method, parameters }),
    "receive": (message: SandboxMessage): void => {
      if (message.kind === "response") {
        const entry = pending.get(message.id);

        pending.delete(message.id);

        return message.ok ? entry?.resolve(message.value) : entry?.reject(new Error(message.error));
      }

      if (message.kind === "request") {
        return void answer(message.id, message.method, message.parameters);
      }

      notificationHandlers.get(message.method)?.(message.parameters);
    },
    "onRequest"     : (method, handler) => requestHandlers.set(method, handler),
    "onNotification": (method, handler) => notificationHandlers.set(method, handler),
  };
}
