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
  type ArkKindType,
  type ArkStateType,
  ValueKinds,
} from "@/lib/extensions/sandbox/ark-surface.ts";

export type ArkNodeType = Record<string, unknown>;
export type StateUpdateType = ArkStateType & { "handle": number };

type TrackedType = {
  "kind"   : ArkKindType;
  "wrapper": ArkNodeType;
  // What the worker mirror holds for 'getValue'/'getChecked'
  "value"  : unknown;
  "checked": unknown;
};

export function invoke(wrapper: ArkNodeType, method: string, input: Array<unknown>): unknown {
  return (wrapper[method] as (...input: Array<unknown>) => unknown)(...input);
}

export function isHandle(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isPrimitive(value: unknown): boolean {
  return value === null || (typeof value !== "object" && typeof value !== "function");
}

function readState(wrapper: ArkNodeType, { field, key }: ArkStateType): unknown {
  switch (field) {
    case "style": {
      return (wrapper.style as Record<string, unknown>)[key as string];
    }
    case "data":
    case "aria": {
      return invoke(wrapper, field === "data" ? "getData" : "getAria", [key]);
    }
    default: {
      return invoke(wrapper, "getCSS", []);
    }
  }
}

// Ark may store something else for these, so the stored value is read back
const CorrectedFields: ReadonlySet<string> = new Set(["data", "aria", "css", "style"]);

export function getCorrection(
  handle: number,
  wrapper: ArkNodeType,
  expected: ArkStateType,
): StateUpdateType | undefined {
  if (!CorrectedFields.has(expected.field)) {
    return undefined;
  }

  const actual = readState(wrapper, expected) as string | undefined;

  return actual === expected.value ? undefined : { handle, ...expected, "value": actual };
}

/**
 * Tracks the values of inputs, textareas, and selects, which change without plugin calls
 * (typing, option changes, invalid values), and reports where the worker mirror is stale.
 *
 * @param onChange - called when a tracked element reports a change
 * @returns functions to track elements and collect mirror updates
 */
export function createValueTracker(onChange: () => void): {
  // Ignores nodes that have no value
  "track"  : (handle: number, kind: ArkKindType, wrapper: ArkNodeType) => void;
  "forget" : (handle: number) => boolean;
  // Records what a 'setValue'/'setChecked' call made the worker mirror hold
  "believe": (handle: number, state: ArkStateType) => void;
  "collect": () => Array<StateUpdateType>;
} {
  const tracked = (new Map<number, TrackedType>);

  return {
    "track": (handle: number, kind: ArkKindType, wrapper: ArkNodeType): void => {
      if (!ValueKinds.has(kind)) {
        return;
      }

      tracked.set(handle, { kind, wrapper, "value": "", "checked": false });
      invoke(wrapper, "onChange", [onChange]);

      if (kind !== "select") {
        invoke(wrapper, "onInput", [onChange]);
      }
    },
    "forget" : (handle: number): boolean => tracked.delete(handle),
    "believe": (handle: number, { field, value }: ArkStateType): void => {
      const entry: TrackedType | undefined = tracked.get(handle);

      if (entry !== undefined && (field === "value" || field === "checked")) {
        entry[field] = value;
      }
    },
    "collect": (): Array<StateUpdateType> => {
      const updates: Array<StateUpdateType> = [];

      for (const [handle, entry] of tracked) {
        const value: unknown = invoke(entry.wrapper, "getValue", []);
        const checked: unknown = entry.kind === "input"
          ? invoke(entry.wrapper, "getChecked", [])
          : false;

        if (value !== entry.value) {
          updates.push({ handle, "field": "value", "key": undefined, "value": value as string });
        }

        if (checked !== entry.checked) {
          updates.push({
            handle,
            "field": "checked",
            "key"  : undefined,
            "value": checked as boolean,
          });
        }

        entry.value = value;
        entry.checked = checked;
      }

      return updates;
    },
  };
}
