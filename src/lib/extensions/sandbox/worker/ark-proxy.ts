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

import { SandboxLimits } from "@/constants/sandbox.ts";
import {
  ArkMethods,
  type ArkStateType,
  DocumentCreators,
  getCreatedKind,
  getExpectedState,
  InteractiveCreators,
} from "@/lib/extensions/sandbox/ark-surface.ts";
import type {
  UIEventType,
  UIOperationType,
  UIStateType,
} from "@/lib/extensions/sandbox/protocol.ts";
import { createEvent } from "@/lib/extensions/sandbox/worker/ark-event.ts";
import {
  applyTreeChange,
  applyUpdates,
  createMirrorNode,
  findById,
  getTextContent,
  type MirrorDocumentType,
  type MirrorNodeType,
  writeState,
} from "@/lib/extensions/sandbox/worker/ark-mirror.ts";
import type { WorkerRpcType } from "@/lib/extensions/sandbox/worker/worker-rpc.ts";

type NodeObjectType = Record<string, unknown>;

const TreeMethods: ReadonlySet<string> = new Set([
  "appendChild",
  "insertBefore",
  "removeChild",
  "replaceChild",
]);

/**
 * Builds the 'ui::basic' and 'ui::interactivity' APIs: the Ark 0.3.1 surface where every
 * changing call becomes an operation for the launcher, batched per tick, and every getter
 * answers from a mirror kept in the worker.
 *
 * @param rpc - the worker side of the launcher protocol
 * @param enqueueMicrotask - 'queueMicrotask' captured before the plugin runs
 * @returns a function that returns 'createSafeDocument' for a UI permission
 */
export function createUIStubs(
  rpc: WorkerRpcType,
  enqueueMicrotask: (callback: () => void) => void,
): (permission: string) => (elementId: unknown) => NodeObjectType {
  const mirrors = (new Map<number, MirrorNodeType>);
  const documents = (new Map<number, MirrorDocumentType>);
  const objects = (new Map<number, NodeObjectType>);
  const handles = (new WeakMap<object, number>);
  const listeners = (new Map<number, { "handle": number; "handler": (event: unknown) => void }>);
  let queue: Array<UIOperationType> = [];
  let nextHandle: number = 1;
  let nextListener: number = 1;
  // The number of the batch that 'queue' becomes
  let batch: number = 1;

  const send = (): void => {
    const operations = queue;

    queue = [];

    if (operations.length > 0) {
      rpc.notify("ui.ops", { operations, batch });
      batch++;
    }
  };
  const push = (operation: UIOperationType): void => {
    if (queue.length === 0) {
      enqueueMicrotask(send);
    }

    queue.push(operation);

    if (queue.length === SandboxLimits.UIOperations) {
      send();
    }
  };
  const assertMounted = ({ failed }: MirrorDocumentType): void => {
    if (failed !== undefined) {
      throw new Error(failed);
    }
  };
  const mirrorOf = (value: unknown): MirrorNodeType | undefined => {
    const handle = typeof value === "object" && value !== null ? handles.get(value) : undefined;

    return handle === undefined ? undefined : mirrors.get(handle);
  };
  // Node arguments travel as handles; Ark stringifies other values or ignores them
  const encode = (method: string, value: unknown): unknown => {
    if ((typeof value === "object" && value !== null) || typeof value === "function") {
      const handle: number | undefined = handles.get(value);

      if (TreeMethods.has(method)) {
        return handle === undefined ? null : { handle };
      }

      return String(value);
    }

    return typeof value === "symbol" ? String(value) : value;
  };

  const getter = (mirror: MirrorNodeType, method: string) => (key?: unknown): unknown => {
    switch (method) {
      case "getText": {
        return getTextContent(mirror);
      }
      case "getData":
      case "getAria": {
        return mirror[method === "getData" ? "data" : "aria"].get(String(key));
      }
      default: {
        const field = method.slice(3).toLowerCase() as "class" | "id" | "css" | "value" | "checked";

        return mirror[field];
      }
    }
  };
  const caller = (mirror: MirrorNodeType, method: string) => (...input: Array<unknown>): void => {
    assertMounted(mirror.document);

    const encoded: Array<unknown> = input.map(value => encode(method, value));
    const expected: ArkStateType | undefined = getExpectedState(mirror.kind, method, encoded);

    applyTreeChange(mirror, method, input.map(value => mirrorOf(value)));

    if (expected !== undefined) {
      writeState(mirror, expected, batch);
    }

    push({ "handle": mirror.handle, method, "input": encoded });
  };
  const listen = (mirror: MirrorNodeType, method: string) => (
    handler: unknown,
    options?: unknown,
  ): (() => void) => {
    assertMounted(mirror.document);

    if (typeof handler !== "function") {
      throw new TypeError("The event handler must be a function");
    }

    const flags = (typeof options === "object" && options !== null ? options : {}) as Record<
      string,
      unknown
    >;
    const listener: number = nextListener++;

    listeners.set(listener, {
      "handle" : mirror.handle,
      "handler": handler as (event: unknown) => void,
    });
    push({
      "handle": mirror.handle,
      "method": "listen",
      "input" : [method, listener, {
        "preventDefault"          : Boolean(flags.preventDefault),
        "stopPropagation"         : Boolean(flags.stopPropagation),
        "stopImmediatePropagation": Boolean(flags.stopImmediatePropagation),
      }],
    });

    return (): void => {
      if (listeners.delete(listener)) {
        push({ "handle": mirror.handle, "method": "unlisten", "input": [listener] });
      }
    };
  };
  const createStyle = (mirror: MirrorNodeType): Record<string, unknown> => new Proxy(
    Object.create(null) as Record<string, unknown>,
    {
      // A property Ark refused to read back is 'undefined', an unset one is empty
      "get": (_target, property): unknown => {
        if (typeof property !== "string") {
          return undefined;
        }

        return mirror.style.has(property) ? mirror.style.get(property) : "";
      },
      "set": (_target, property, value): boolean => {
        if (typeof property !== "string") {
          return false;
        }

        caller(mirror, "setStyle")(property, value);

        return true;
      },
    },
  );

  function creator(
    document: MirrorDocumentType,
    owner: number,
    method: string,
    list?: MirrorNodeType,
  ): (...input: Array<unknown>) => NodeObjectType {
    return (...input: Array<unknown>): NodeObjectType => {
      assertMounted(document);

      const mirror = createMirrorNode(nextHandle++, getCreatedKind(method, input), document);

      mirrors.set(mirror.handle, mirror);
      push({
        "handle": owner,
        method,
        "input" : input.map(value => encode(method, value)),
        "result": mirror.handle,
      });

      if (list !== undefined) {
        applyTreeChange(list, "appendChild", [mirror]);
      }

      return createNode(mirror);
    };
  }

  function createNode(mirror: MirrorNodeType): NodeObjectType {
    const node: NodeObjectType = {};

    for (const method of ArkMethods[mirror.kind]) {
      if (method.startsWith("get")) {
        node[method] = getter(mirror, method);
      } else if (method.startsWith("on")) {
        node[method] = listen(mirror, method);
      } else if (method.startsWith("create")) {
        node[method] = creator(mirror.document, mirror.handle, method, mirror);
      } else {
        node[method] = caller(mirror, method);
      }
    }

    if (mirror.kind !== "text" && mirror.kind !== "styleSheet") {
      node.style = createStyle(mirror);
    }

    objects.set(mirror.handle, node);
    handles.set(node, mirror.handle);

    return node;
  }

  rpc.onNotification("ui.state", parameters => applyUpdates(mirrors, parameters as UIStateType));
  rpc.onNotification("ui.failed", parameters => {
    const { handle, message } = parameters as { "handle": number; "message": string };
    const document = documents.get(handle);

    if (document !== undefined) {
      document.failed = message;
    }
  });
  rpc.onNotification("ui.event", parameters => {
    const { listener, event } = parameters as { "listener": number; "event": UIEventType };
    const entry = listeners.get(listener);

    entry?.handler(createEvent(event, (side, value) => push({
      "handle": entry.handle,
      "method": "setEventTargetValue",
      "input" : [listener, side, value],
    })));
  });

  return (permission: string) => (elementId: unknown): NodeObjectType => {
    const document: MirrorDocumentType = {
      "handle"   : nextHandle++,
      "elementId": String(elementId),
      "root"     : undefined,
      "failed"   : undefined,
    };
    const root = createMirrorNode(nextHandle++, "element", document);

    root.id = document.elementId;
    document.root = root;
    documents.set(document.handle, document);
    mirrors.set(root.handle, root);
    push({
      "handle": document.handle,
      "method": "mount",
      "input" : [document.elementId, permission],
      "result": root.handle,
    });
    createNode(root);

    const api: NodeObjectType = {};

    for (const method of Object.keys(DocumentCreators)) {
      api[method] = permission !== "ui::interactivity" && InteractiveCreators.has(method)
        ? undefined
        : creator(document, document.handle, method);
    }

    api.getElement = (id: unknown): NodeObjectType | null => {
      assertMounted(document);

      const found: MirrorNodeType | undefined = findById(document, String(id));

      return found === undefined ? null : objects.get(found.handle) ?? null;
    };

    return Object.freeze(api);
  };
}
