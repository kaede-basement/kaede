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

export type MeasuredMessageType = "valid" | "malformed" | "too-large";

const MaxDepth = 64;
const EntryBytes = 8;

function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function sizeOfLeaf(value: unknown): number | undefined {
  switch (typeof value) {
    case "string": {
      return value.length * 2;
    }
    case "number":
    case "boolean":
    case "undefined": {
      return EntryBytes;
    }
    default: {
      if (value === null) {
        return EntryBytes;
      }

      if (value instanceof ArrayBuffer) {
        return value.byteLength;
      }

      // A cloned view carries its whole underlying buffer
      if (ArrayBuffer.isView(value)) {
        return value.buffer.byteLength;
      }

      return undefined;
    }
  }
}

/**
 * Checks that a message received from a worker consists only of data the protocol uses
 * (primitives, arrays, plain objects, binary buffers) and estimates its size.
 * Repeated references are rejected, so cycles cannot keep the walk going.
 *
 * @param message - a structured clone received from the worker
 * @param limit - the maximum estimated size in bytes
 * @returns whether the message is valid, malformed, or too large
 */
export function measureMessage(message: unknown, limit: number): MeasuredMessageType {
  const seen = (new Set<object>);
  const stack: Array<[unknown, number]> = [[message, 0]];
  let size: number = 0;

  while (stack.length > 0) {
    const [value, depth] = stack.pop() as [unknown, number];
    const leaf: number | undefined = sizeOfLeaf(value);

    if (leaf !== undefined) {
      size += leaf;
    } else if (typeof value === "object" && value !== null && depth < MaxDepth) {
      if (seen.has(value) || !(Array.isArray(value) || isPlainObject(value))) {
        return "malformed";
      }

      seen.add(value);

      const array: boolean = Array.isArray(value);

      // Holes are not entries, but whoever walks the array still visits every index
      if (array) {
        size += (value as Array<unknown>).length * EntryBytes;
      }

      for (const [key, child] of Object.entries(value)) {
        size += (array ? 0 : EntryBytes) + (key.length * 2);
        stack.push([child, depth + 1]);
      }
    } else {
      return "malformed";
    }

    if (size > limit) {
      return "too-large";
    }
  }

  return "valid";
}
