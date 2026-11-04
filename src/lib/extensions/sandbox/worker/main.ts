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

import type {
  SandboxBootMessage,
  SandboxLifecycleHook,
  SandboxMessage,
} from "@/lib/extensions/sandbox/protocol.ts";
import { createPermissionStubs } from "@/lib/extensions/sandbox/worker/permission-stubs.ts";
import {
  stripGlobal,
  WorkerGlobalAllowlist,
} from "@/lib/extensions/sandbox/worker/strip-global.ts";
import { tameDate } from "@/lib/extensions/sandbox/worker/tame-date.ts";
import { createWorkerRpc, describeError } from "@/lib/extensions/sandbox/worker/worker-rpc.ts";

/*
 * The entry point of a sandboxed plugin worker. It must not import launcher modules:
 * everything here runs inside the worker, next to the plugin code.
 */

const LifecycleHooks: ReadonlyArray<SandboxLifecycleHook> = [
  "enable",
  "disable",
  "afterDisable",
];

function boot(event: MessageEvent<SandboxBootMessage>): void {
  const [port] = event.ports;
  const { source, permissions } = event.data;

  if (port === undefined) {
    return;
  }

  // Capture everything the sandbox needs before the global object is stripped
  const send = port.postMessage.bind(port) as (message: SandboxMessage) => void;
  const evaluateIndirectly: (code: string) => unknown = globalThis.eval;
  const captures = {
    "Date"          : Date,
    "queueMicrotask": queueMicrotask,
    "decoder"       : (new TextDecoder),
    "performanceNow": performance.now.bind(performance),
    "timeOrigin"    : performance.timeOrigin,
  };
  const rpc = createWorkerRpc(send);

  port.addEventListener("message", (message: MessageEvent<SandboxMessage>) => (
    rpc.receive(message.data)
  ));
  port.start();

  const undeletable: Array<string> = stripGlobal(globalThis, WorkerGlobalAllowlist);

  if (undeletable.length > 0) {
    return rpc.notify("fatal", {
      "message": `Could not remove these globals: ${undeletable.join(", ")}`,
    });
  }

  const stub = createPermissionStubs(rpc, captures);
  const requestPermissions = async (requested: unknown): Promise<Array<unknown>> => {
    const decisions = await rpc.call("requestPermissions", { "permissions": requested });

    return (decisions as Array<[string, boolean]>).map(([permission, granted]) => (
      granted ? stub(permission) : false
    ));
  };

  Object.defineProperties(globalThis, {
    "Date": {
      "value"       : tameDate(captures.Date),
      "writable"    : true,
      "configurable": true,
    },
    "requestPermissions": { "value": requestPermissions, "writable": true, "configurable": true },
    "scopedThis"        : {
      "value": Object.freeze(Object.fromEntries(
        permissions.map(permission => [permission, stub(permission)]),
      )),
      "writable"    : true,
      "configurable": true,
    },
  });

  const hooks = (new Map<string, () => unknown>);
  let result: unknown;

  try {
    // Evaluated only after stripping; strict mode keeps the semantics plugins had under SES
    result = evaluateIndirectly(`"use strict";${source}`);

    for (const hook of LifecycleHooks) {
      const handler: unknown = typeof result === "object" && result !== null
        ? (result as Record<string, unknown>)[hook]
        : undefined;

      if (typeof handler === "function") {
        hooks.set(hook, handler as () => unknown);
      }
    }
  } catch (error: unknown) {
    return rpc.notify("fatal", { "message": describeError(error) });
  }

  rpc.onRequest("lifecycle", async (parameters: unknown): Promise<void> => {
    const handler = hooks.get((parameters as { "hook": string }).hook);

    if (handler !== undefined) {
      await Reflect.apply(handler, result, []);
    }
  });
  rpc.notify("ready", {});
}

globalThis.addEventListener("message", boot as (event: MessageEvent) => void, { "once": true });
