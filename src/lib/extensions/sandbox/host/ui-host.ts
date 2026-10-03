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

import type { SafeDocument } from "ark-of-atrahasis";

import {
  type ArkKindType,
  ArkMethods,
  type ArkStateType,
  getCreatedKind,
  getExpectedState,
  InteractiveCreators,
} from "@/lib/extensions/sandbox/ark-surface.ts";
import { getParameter } from "@/lib/extensions/sandbox/host/host-methods.ts";
import { describeError, SandboxLimitError } from "@/lib/extensions/sandbox/host/sandbox-host.ts";
import {
  createEventForwarder,
  type ListenerOptionsType,
} from "@/lib/extensions/sandbox/host/ui-events.ts";
import { createNodeTable } from "@/lib/extensions/sandbox/host/ui-nodes.ts";
import {
  type ArkNodeType,
  createValueTracker,
  getCorrection,
  invoke,
  isHandle,
  isPrimitive,
  type StateUpdateType,
} from "@/lib/extensions/sandbox/host/ui-values.ts";
import type { UIStateType } from "@/lib/extensions/sandbox/protocol.ts";

type MountType = {
  "permission": string;
  "unmount"   : () => void;
};
type NodeEntryType = {
  "kind"   : ArkKindType;
  "wrapper": ArkNodeType;
  "mount"  : MountType;
};

export type UIEnvironmentType = {
  // Creates the plugin container inside a launcher element, or returns 'undefined' if it is missing
  "mount": (elementId: string) => {
    "containerId": string;
    "unmount"    : () => void;
  } | undefined;
  "createSafeDocument": (containerId: string) => SafeDocument;
  "scheduleFrame"     : (callback: () => void) => void;
  // The current target of the event being dispatched; Ark's events do not expose it
  "currentTarget"     : () => object | null;
};

const UIPermissions: ReadonlySet<unknown> = new Set(["ui::basic", "ui::interactivity"]);

/**
 * Applies UI operations of one plugin to the launcher DOM through Ark and keeps
 * the worker mirror in sync.
 *
 * @param options - how to reach the worker, check grants, and touch the DOM
 * @returns functions to apply an operation batch and to remove everything the plugin created
 */
export function createUIHost({ notify, isGranted, maxNodes, maxOperations, environment }: {
  "notify"       : (method: string, parameters: unknown) => void;
  "isGranted"    : (permission: string) => boolean;
  "maxNodes"     : number;
  "maxOperations": number;
  "environment"  : UIEnvironmentType;
}): { "apply": (parameters: unknown) => void; "dispose": () => void } {
  const nodes = createNodeTable<NodeEntryType>(maxNodes);
  const mounts: Array<MountType> = [];
  const values = createValueTracker(() => flush());
  let updates: Array<StateUpdateType> = [];
  // The worker numbers its batches and skips updates older than its own later writes
  let batch: number = 0;

  const flush = (): void => {
    updates.push(...values.collect());

    if (updates.length > 0) {
      notify("ui.state", { batch, updates } satisfies UIStateType);
      updates = [];
    }
  };
  const events = createEventForwarder({
    "scheduleFrame": environment.scheduleFrame,
    "send"         : (listener, event) => {
      // The mirror must be current before the plugin handler reads 'getValue'
      flush();
      notify("ui.event", { listener, event });
    },
    "currentTarget": environment.currentTarget,
  });
  const register = (handle: number, entry: NodeEntryType): void => {
    nodes.add(handle, entry);
    values.track(handle, entry.kind, entry.wrapper);
  };
  const resolve = (value: unknown): unknown => {
    if (isPrimitive(value)) {
      return value;
    }

    const entry: NodeEntryType | undefined = nodes.get((value as Record<string, unknown>).handle);

    if (entry === undefined || entry.kind === "document") {
      throw new TypeError("A node argument is not a node of this plugin");
    }

    return entry.wrapper;
  };

  const mount = (
    handle: number,
    [elementId, permission]: Array<unknown>,
    result: unknown,
  ): void => {
    if (!UIPermissions.has(permission) || !isGranted(permission as string)) {
      throw new Error("A granted UI permission is required to create a document");
    }

    // Before any DOM change, so a rejected creation leaves nothing behind
    nodes.reserve([handle, result], 1);

    const mounted = environment.mount(String(elementId));

    if (mounted === undefined) {
      const message: string = `No HTML element with the '${String(elementId)}' id was found`;

      notify("ui.failed", { handle, message });
      throw new Error(message);
    }

    const document: SafeDocument = environment.createSafeDocument(mounted.containerId);
    const container = document.getElement(mounted.containerId) as unknown as ArkNodeType;
    const root = document.createDiv() as unknown as ArkNodeType;
    const entry: MountType = { "permission": permission as string, "unmount": mounted.unmount };

    mounts.push(entry);
    invoke(container, "appendChild", [root]);
    register(handle, {
      "kind"   : "document",
      "wrapper": document as unknown as ArkNodeType,
      "mount"  : entry,
    });
    register(result as number, { "kind": "element", "wrapper": root, "mount": entry });
  };
  const call = (
    handle: number,
    entry: NodeEntryType,
    method: string,
    input: Array<unknown>,
  ): void => {
    if (method === "setStyle") {
      if (typeof input[0] !== "string" || entry.wrapper.style === undefined) {
        throw new TypeError("Invalid style assignment");
      }

      Reflect.set(entry.wrapper.style as object, input[0], input[1]);
    } else {
      invoke(entry.wrapper, method, input.map(value => resolve(value)));
    }

    // Ark unregisters a removed node, so it cannot be attached again and its listeners can go
    if (method === "remove") {
      nodes.delete(handle);
      values.forget(handle);
      events.release(handle);
    }

    const expected: ArkStateType | undefined = getExpectedState(entry.kind, method, input);

    if (expected === undefined) {
      return;
    }

    values.believe(handle, expected);

    const correction: StateUpdateType | undefined = getCorrection(handle, entry.wrapper, expected);

    if (correction !== undefined) {
      updates.push(correction);
    }
  };
  const create = (
    entry: NodeEntryType,
    method: string,
    input: Array<unknown>,
    result: unknown,
  ): void => {
    const interactive: boolean = entry.mount.permission === "ui::interactivity";

    if (entry.kind === "document" && InteractiveCreators.has(method) && !interactive) {
      throw new Error(`'${method}' requires the 'ui::interactivity' permission`);
    }

    if (!input.every(value => isPrimitive(value))) {
      throw new TypeError("Creator arguments must be primitives");
    }

    const kind: ArkKindType = getCreatedKind(method, input);

    nodes.reserve([result], 1);

    const wrapper = invoke(entry.wrapper, method, input) as ArkNodeType;

    register(result as number, { kind, wrapper, "mount": entry.mount });
  };
  const listen = (handle: number, entry: NodeEntryType, input: Array<unknown>): void => {
    const [event, listener, options] = input;

    const known: boolean = typeof event === "string" &&
      (/^on[A-Z]/).test(event) &&
      ArkMethods[entry.kind].has(event);

    if (!known) {
      throw new Error("Unknown event");
    }

    events.listen(listener, handle, event as string, options as ListenerOptionsType, handler => (
      invoke(entry.wrapper, event as string, [handler]) as () => void
    ));
  };

  const applyOperation = (operation: unknown): void => {
    const handle: unknown = getParameter(operation, "handle");
    const method: unknown = getParameter(operation, "method");
    const input: unknown = getParameter(operation, "input");

    if (!isHandle(handle) || typeof method !== "string" || !Array.isArray(input)) {
      throw new TypeError("A UI operation is malformed");
    }

    if (method === "mount") {
      return mount(handle, input, getParameter(operation, "result"));
    }

    // Also reached after the node was removed, which released its listeners
    if (method === "unlisten") {
      return events.unlisten(input[0], handle);
    }

    const entry: NodeEntryType | undefined = nodes.get(handle);

    if (entry === undefined) {
      throw new Error(`Unknown node handle ${handle}`);
    }

    if (!isGranted(entry.mount.permission)) {
      throw new Error(`The '${entry.mount.permission}' permission is not granted`);
    }

    switch (method) {
      case "listen": {
        return listen(handle, entry, input);
      }
      case "setEventTargetValue": {
        return events.setTargetValue(input[0], handle, input[1], input[2]);
      }
      case "setStyle": {
        return call(handle, entry, method, input);
      }
    }

    if (!ArkMethods[entry.kind].has(method) || (/^(?:get|on)[A-Z]/).test(method)) {
      throw new Error(`Unknown method '${method.slice(0, 64)}'`);
    }

    return method.startsWith("create")
      ? create(entry, method, input, getParameter(operation, "result"))
      : call(handle, entry, method, input);
  };

  return {
    "apply": (parameters: unknown): void => {
      const operations: unknown = getParameter(parameters, "operations");
      const number: unknown = getParameter(parameters, "batch");

      if (!Array.isArray(operations) || !isHandle(number)) {
        throw new TypeError("A UI batch is malformed");
      }

      if (operations.length > maxOperations) {
        throw new SandboxLimitError(`a UI batch had more than ${maxOperations} operations`);
      }

      const rejected: Array<string> = [];

      batch = number;

      for (const operation of operations) {
        try {
          applyOperation(operation);
        } catch (error: unknown) {
          if (error instanceof SandboxLimitError) {
            throw error;
          }

          rejected.push(describeError(error));
        }
      }

      flush();

      if (rejected.length > 0) {
        throw new Error(`Rejected ${rejected.length} UI operation(s), the first: ${rejected[0]}`);
      }
    },
    "dispose": (): void => {
      events.dispose();

      for (const { unmount } of mounts) {
        unmount();
      }

      nodes.clear();
    },
  };
}
