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

import type { SafeEvent } from "ark-of-atrahasis";

import type { UIEventTargetType, UIEventType } from "@/lib/extensions/sandbox/protocol.ts";

export type ListenerOptionsType = {
  "preventDefault"          ?: unknown;
  "stopPropagation"         ?: unknown;
  "stopImmediatePropagation"?: unknown;
};

type ListenerType = {
  "handle" : number;
  "cleanup": () => void;
  // The last native event, used for 'event.target.value = value' from the worker
  "last"   : SafeEvent | undefined;
  // The element the listener is attached to, for 'event.currentTarget.value = value'
  "element": object | null;
  "pending": UIEventType | undefined;
};

// High-frequency events reach the worker at most once per animation frame
const CoalescedEvents: ReadonlySet<string> = new Set([
  "onMouseMove",
  "onPointerMove",
  "onTouchMove",
  "onScroll",
]);

function toTarget({ id, value }: SafeEvent["target"]): UIEventTargetType {
  const primitive: boolean = typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean";

  return { id, "value": primitive ? value as UIEventTargetType["value"] : undefined };
}

export function toSnapshot(event: SafeEvent): UIEventType {
  return {
    "type"         : event.type,
    "ctrlKey"      : event.ctrlKey,
    "altKey"       : event.altKey,
    "shiftKey"     : event.shiftKey,
    "metaKey"      : event.metaKey,
    "target"       : toTarget(event.target),
    "currentTarget": toTarget(event.currentTarget),
  };
}

/**
 * Attaches plugin listeners through Ark and forwards event snapshots to the worker.
 * 'preventDefault' and the propagation methods must run synchronously, so the plugin
 * passes them as listener options and they are applied here.
 *
 * @param options - the frame scheduler, the function that posts an event to the worker, and
 * the function that returns the current target of the event being dispatched
 * @returns functions to manage the listeners of one plugin
 */
export function createEventForwarder({ scheduleFrame, send, currentTarget }: {
  "scheduleFrame": (callback: () => void) => void;
  "send"         : (listener: number, event: UIEventType) => void;
  "currentTarget": () => object | null;
}): {
  "listen": (
    listener: unknown,
    handle: number,
    event: string,
    options: ListenerOptionsType,
    attach: (handler: (event: SafeEvent) => void) => () => void,
  ) => void;
  "unlisten"      : (listener: unknown, handle: number) => void;
  // Removes every listener of a node
  "release"       : (handle: number) => void;
  "setTargetValue": (listener: unknown, handle: number, side: unknown, value: unknown) => void;
  "dispose"       : () => void;
} {
  const listeners = (new Map<unknown, ListenerType>);
  let disposed: boolean = false;

  const find = (listener: unknown, handle: number): ListenerType => {
    const entry: ListenerType | undefined = listeners.get(listener);

    if (entry === undefined || entry.handle !== handle) {
      throw new Error("Unknown listener");
    }

    return entry;
  };

  return {
    "listen": (listener, handle, event, options, attach): void => {
      const valid: boolean = typeof listener === "number" &&
        Number.isSafeInteger(listener) &&
        listener > 0 &&
        typeof options === "object" &&
        options !== null;

      if (!valid || listeners.has(listener)) {
        throw new TypeError("The listener is invalid or already used");
      }

      const entry: ListenerType = {
        handle,
        "cleanup": () => {},
        "last"   : undefined,
        "element": null,
        "pending": undefined,
      };
      const flags = {
        "preventDefault"          : options.preventDefault === true,
        "stopPropagation"         : options.stopPropagation === true,
        "stopImmediatePropagation": options.stopImmediatePropagation === true,
      };

      entry.cleanup = attach((native: SafeEvent): void => {
        if (flags.preventDefault) {
          native.preventDefault();
        }

        if (flags.stopPropagation) {
          native.stopPropagation();
        }

        if (flags.stopImmediatePropagation) {
          native.stopImmediatePropagation();
        }

        entry.last = native;
        entry.element = currentTarget();

        if (!CoalescedEvents.has(event)) {
          return send(listener as number, toSnapshot(native));
        }

        const scheduled: boolean = entry.pending !== undefined;

        entry.pending = toSnapshot(native);

        if (!scheduled) {
          scheduleFrame(() => {
            const pending: UIEventType | undefined = entry.pending;

            entry.pending = undefined;

            if (pending !== undefined && !disposed && listeners.get(listener) === entry) {
              send(listener as number, pending);
            }
          });
        }
      });
      listeners.set(listener, entry);
    },
    // A listener released with its node is unknown here, and unlistening it does nothing
    "unlisten": (listener, handle): void => {
      if (listeners.has(listener)) {
        find(listener, handle).cleanup();
        listeners.delete(listener);
      }
    },
    "release": (handle): void => {
      for (const [listener, entry] of listeners) {
        if (entry.handle === handle) {
          entry.cleanup();
          listeners.delete(listener);
        }
      }
    },
    "setTargetValue": (listener, handle, side, value): void => {
      const { last, element } = find(listener, handle);

      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        throw new TypeError("Invalid input: expected string, number, or boolean");
      }

      if (side === "target" && last !== undefined) {
        last.target.value = value;
      } else if (side === "currentTarget" && element !== null) {
        // Ark's own setter, which does nothing after dispatch: the native current target is 'null'
        if ("value" in element) {
          element.value = String(value);
        }
      } else {
        throw new Error("There is no event target to set the value on");
      }
    },
    "dispose": (): void => {
      disposed = true;

      for (const { cleanup } of listeners.values()) {
        cleanup();
      }

      listeners.clear();
    },
  };
}
