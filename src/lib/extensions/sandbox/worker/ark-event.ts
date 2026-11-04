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

import type { UIEventTargetType, UIEventType } from "@/lib/extensions/sandbox/protocol.ts";

type SideType = "target" | "currentTarget";

// These run on the launcher before the event reaches the worker, so they are listener options
const LateMethods = ["preventDefault", "stopPropagation", "stopImmediatePropagation"] as const;

/**
 * Builds the Ark 'SafeEvent' a plugin listener receives from an event snapshot.
 *
 * @param snapshot - the event data forwarded by the launcher
 * @param setValue - sends 'event.target.value = value' to the launcher
 * @returns a frozen event object
 */
export function createEvent(
  snapshot: UIEventType,
  setValue: (side: SideType, value: string | number | boolean) => void,
): unknown {
  const createTarget = (side: SideType): UIEventTargetType => {
    let current: UIEventTargetType["value"] = snapshot[side].value;

    return {
      "id": snapshot[side].id,
      get "value"(): UIEventTargetType["value"] {
        return current;
      },
      set "value"(input: UIEventTargetType["value"]) {
        if (typeof input !== "string" && typeof input !== "number" && typeof input !== "boolean") {
          throw new TypeError("Invalid input: expected string, number, or boolean");
        }

        current = input;
        setValue(side, input);
      },
    };
  };
  const late = Object.fromEntries(LateMethods.map(method => [method, (): void => {
    // The warning goes to the console of the plugin's own worker
    // eslint-disable-next-line no-console
    console.warn(
      `'${method}()' has no effect in a sandboxed plugin listener;`,
      `pass '{ ${method}: true }' as the second argument of the listener instead`,
    );
  }]));

  return Object.freeze({
    "type"         : snapshot.type,
    "ctrlKey"      : snapshot.ctrlKey,
    "altKey"       : snapshot.altKey,
    "shiftKey"     : snapshot.shiftKey,
    "metaKey"      : snapshot.metaKey,
    "target"       : createTarget("target"),
    "currentTarget": createTarget("currentTarget"),
    ...late,
  });
}
