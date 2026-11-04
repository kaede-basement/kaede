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

// ECMAScript intrinsics and the few Web APIs that give a plugin no access outside its worker
export const WorkerGlobalAllowlist: ReadonlySet<string> = new Set([
  "globalThis",
  "Infinity",
  "NaN",
  "undefined",
  "eval",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt",
  "decodeURI",
  "decodeURIComponent",
  "encodeURI",
  "encodeURIComponent",
  "escape",
  "unescape",
  "Object",
  "Function",
  "Boolean",
  "Symbol",
  "Error",
  "AggregateError",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
  "SuppressedError",
  "Number",
  "BigInt",
  "Math",
  "Date",
  "String",
  "RegExp",
  "Array",
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float16Array",
  "Float32Array",
  "Float64Array",
  "BigInt64Array",
  "BigUint64Array",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "WeakRef",
  "FinalizationRegistry",
  "ArrayBuffer",
  "SharedArrayBuffer",
  "DataView",
  "Atomics",
  "JSON",
  "Iterator",
  "Promise",
  "Proxy",
  "Reflect",
  "Intl",
  "DisposableStack",
  "AsyncDisposableStack",
  "console",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "queueMicrotask",
  "TextEncoder",
  "TextDecoder",
  "structuredClone",
]);

/**
 * Deletes every property of the global object and of its prototype chain
 * that is not in the allowlist. A property that cannot be deleted is tolerated only
 * if it holds a primitive value (e.g., 'TEMPORARY' in Chromium workers).
 *
 * @param target - the global object
 * @param allowlist - names of the global properties to keep
 * @returns names of the undeletable properties that may hold objects or functions;
 * the plugin must not run if this list is not empty
 */
export function stripGlobal(target: object, allowlist: ReadonlySet<string>): Array<string> {
  const undeletable: Array<string> = [];

  for (
    let current: object | null = target;
    current !== null && current !== Object.prototype;
    current = Reflect.getPrototypeOf(current)
  ) {
    for (const key of Reflect.ownKeys(current)) {
      if (typeof key === "string" && allowlist.has(key)) {
        continue;
      }

      const descriptor: PropertyDescriptor | undefined = Reflect.getOwnPropertyDescriptor(
        current,
        key,
      );

      if (Reflect.deleteProperty(current, key) || descriptor === undefined) {
        continue;
      }

      const holdsPrimitive: boolean = !("get" in descriptor) && !("set" in descriptor) && (
        (typeof descriptor.value !== "object" && typeof descriptor.value !== "function") ||
        descriptor.value === null
      );

      if (!holdsPrimitive) {
        undeletable.push(String(key));
      }
    }
  }

  return undeletable;
}
