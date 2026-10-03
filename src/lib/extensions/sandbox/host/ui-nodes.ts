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

import type { ArkKindType } from "@/lib/extensions/sandbox/ark-surface.ts";
import { SandboxLimitError } from "@/lib/extensions/sandbox/host/sandbox-host.ts";
import { isHandle } from "@/lib/extensions/sandbox/host/ui-values.ts";

/**
 * The live UI nodes of one plugin by handle. Every node except a document counts toward
 * the node limit.
 *
 * @param maxNodes - the node limit; exceeding it terminates the plugin
 * @returns functions to look up, reserve, add, and delete nodes
 */
export function createNodeTable<EntryType extends { "kind": ArkKindType }>(maxNodes: number): {
  "get"    : (handle: unknown) => EntryType | undefined;
  // Throws unless the handles are new and distinct and 'counted' more nodes fit the limit
  "reserve": (handles: Array<unknown>, counted: number) => void;
  "add"    : (handle: number, entry: EntryType) => void;
  "delete" : (handle: number) => void;
  "clear"  : () => void;
} {
  const nodes = (new Map<number, EntryType>);
  let count: number = 0;

  return {
    "get"    : handle => (isHandle(handle) ? nodes.get(handle) : undefined),
    "reserve": (handles, counted): void => {
      const valid: boolean = handles.every(handle => isHandle(handle) && !nodes.has(handle)) &&
        new Set(handles).size === handles.length;

      if (!valid) {
        throw new TypeError("The new node handle is invalid or already used");
      }

      if (count + counted > maxNodes) {
        throw new SandboxLimitError(`the plugin created more than ${maxNodes} UI nodes`);
      }
    },
    "add": (handle, entry): void => {
      count += entry.kind === "document" ? 0 : 1;
      nodes.set(handle, entry);
    },
    "delete": (handle): void => {
      const entry: EntryType | undefined = nodes.get(handle);

      if (entry !== undefined) {
        count -= entry.kind === "document" ? 0 : 1;
        nodes.delete(handle);
      }
    },
    "clear": (): void => {
      count = 0;
      nodes.clear();
    },
  };
}
