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

import {
  type MeasuredMessageType,
  measureMessage,
} from "@/lib/extensions/sandbox/host/measure-message.ts";
import type { SandboxMessage } from "@/lib/extensions/sandbox/protocol.ts";
import { log } from "@/lib/logging/log.ts";

// Thrown by a method handler when the plugin exceeded a limit and must be terminated
export class SandboxLimitError extends Error {}

export type SandboxPortType = Pick<
  MessagePort,
  "addEventListener" | "start" | "postMessage" | "close"
>;

export type SandboxHostType = {
  // Calls a worker method; a timeout terminates the plugin
  "request"     : (method: string, parameters: unknown, timeoutMs: number) => Promise<unknown>;
  "notify"      : (method: string, parameters: unknown) => void;
  "terminate"   : (reason: string) => void;
  "isTerminated": () => boolean;
};

export type SandboxHostMethodType = {
  "kind"  : "request" | "notify";
  // Throws to reject the call; 'parameters' are untrusted and must be validated by the handler
  "handle": (parameters: unknown, host: SandboxHostType) => unknown;
};

type PendingRequestType = {
  "resolve": (value: unknown) => void;
  "reject" : (error: Error) => void;
  "timer"  : ReturnType<typeof setTimeout>;
};

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessageId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

// Keeps plugin-controlled strings short in the launcher logs
function quote(value: unknown): string {
  return typeof value === "string" ? `'${value.slice(0, 64)}'` : typeof value;
}

/**
 * The launcher side of one plugin worker: validates every incoming message,
 * dispatches it through a fixed method table, and terminates the plugin when it hangs
 * or exceeds a limit.
 *
 * @param options - the plugin label, its port, the method table, and the limits
 * @returns functions to talk to the worker and terminate it
 */
export function createSandboxHost({
  id,
  port,
  methods,
  messageBytes,
  terminateWorker,
  onTerminated,
}: {
  "id"             : string;
  "port"           : SandboxPortType;
  "methods"        : Record<string, SandboxHostMethodType>;
  "messageBytes"   : number;
  "terminateWorker": () => void;
  "onTerminated"   : (reason: string) => void;
}): SandboxHostType {
  const table = new Map<string, SandboxHostMethodType>(Object.entries(methods));
  const pending = (new Map<number, PendingRequestType>);
  let nextRequestId: number = 1;
  let terminated: boolean = false;

  const reject = (reason: string): void => {
    log.warn(__PRE_BUNDLED_FILENAME__, `Rejected a message from the '${id}' extension: ${reason}`);
  };
  const post = (message: SandboxMessage): void => {
    if (!terminated) {
      port.postMessage(message);
    }
  };
  const reply = (requestId: number, settled: { "value": unknown } | { "error": string }): void => {
    try {
      post("value" in settled
        ? { "kind": "response", "id": requestId, "ok": true, "value": settled.value }
        : { "kind": "response", "id": requestId, "ok": false, "error": settled.error });
    } catch (error: unknown) {
      post({ "kind": "response", "id": requestId, "ok": false, "error": describeError(error) });
    }
  };

  const host: SandboxHostType = {
    "request": (method, parameters, timeoutMs) => {
      if (terminated) {
        return Promise.reject(new Error(`The '${id}' extension was terminated`));
      }

      const requestId: number = nextRequestId++;

      return new Promise((resolve, rejectRequest) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          rejectRequest(new Error(`'${method}' did not finish in ${timeoutMs} ms`));
          host.terminate(`'${method}' did not finish in ${timeoutMs} ms`);
        }, timeoutMs);

        pending.set(requestId, { resolve, "reject": rejectRequest, timer });
        post({ "kind": "request", "id": requestId, method, parameters });
      });
    },
    "notify"   : (method, parameters) => post({ "kind": "notify", method, parameters }),
    "terminate": reason => {
      if (terminated) {
        return;
      }

      terminated = true;
      port.close();
      terminateWorker();

      for (const { timer, "reject": rejectRequest } of pending.values()) {
        clearTimeout(timer);
        rejectRequest(new Error(`The '${id}' extension was terminated: ${reason}`));
      }

      pending.clear();
      log.error(__PRE_BUNDLED_FILENAME__, `Terminated the '${id}' extension: ${reason}`);
      onTerminated(reason);
    },
    "isTerminated": () => terminated,
  };

  const settle = (message: Record<string, unknown>): void => {
    const entry: PendingRequestType | undefined = isMessageId(message.id)
      ? pending.get(message.id)
      : undefined;

    if (entry === undefined) {
      return reject(`a response to an unknown request ${quote(message.id)}`);
    }

    pending.delete(message.id as number);
    clearTimeout(entry.timer);

    if (message.ok === true) {
      return entry.resolve(message.value);
    }

    entry.reject(new Error(typeof message.error === "string" ? message.error : "Unknown error"));
  };
  const invoke = async (
    method: SandboxHostMethodType,
    parameters: unknown,
  ): Promise<{ "value": unknown } | { "error": string } | undefined> => {
    try {
      return { "value": await method.handle(parameters, host) };
    } catch (error: unknown) {
      if (error instanceof SandboxLimitError) {
        host.terminate(error.message);

        return undefined;
      }

      return { "error": describeError(error) };
    }
  };
  const dispatch = async (message: Record<string, unknown>): Promise<void> => {
    const { kind, method } = message;
    const entry: SandboxHostMethodType | undefined = typeof method === "string"
      ? table.get(method)
      : undefined;

    if (kind === "request" && isMessageId(message.id)) {
      const requestId: number = message.id;

      if (entry?.kind !== "request") {
        reject(`an unknown request method ${quote(method)}`);

        return reply(requestId, { "error": `Unknown method ${quote(method)}` });
      }

      const settled = await invoke(entry, message.parameters);

      return settled === undefined ? undefined : reply(requestId, settled);
    }

    if (kind === "notify" && entry?.kind === "notify") {
      const settled = await invoke(entry, message.parameters);

      return settled !== undefined && "error" in settled
        ? reject(`${quote(method)} failed: ${settled.error}`)
        : undefined;
    }

    reject(kind === "notify"
      ? `an unknown notification method ${quote(method)}`
      : `an unknown message kind ${quote(kind)}`);
  };

  port.addEventListener("message", (event: MessageEvent<unknown>): void => {
    if (terminated) {
      return;
    }

    if (event.ports.length > 0) {
      return reject("a message must not transfer ports");
    }

    const measured: MeasuredMessageType = measureMessage(event.data, messageBytes);

    if (measured === "too-large") {
      return host.terminate(`a message exceeded ${messageBytes} bytes`);
    }

    if (measured === "malformed" || !isRecord(event.data)) {
      return reject("the message is malformed");
    }

    if (event.data.kind === "response") {
      return settle(event.data);
    }

    void dispatch(event.data);
  });
  port.addEventListener("messageerror", () => reject("the message could not be deserialized"));
  port.start();

  return host;
}
