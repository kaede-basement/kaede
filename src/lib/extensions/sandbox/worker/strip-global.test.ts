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

import { expect, test } from "bun:test";

import { stripGlobal } from "@/lib/extensions/sandbox/worker/strip-global.ts";

function createFakeGlobal(): Record<string, unknown> {
  const prototype: Record<string, unknown> = {
    "addEventListener": () => {},
    "postMessage"     : () => {},
  };
  const fakeGlobal: Record<string, unknown> = Object.create(prototype);

  fakeGlobal.Object = Object;
  fakeGlobal.console = console;
  fakeGlobal.fetch = (): void => {};
  fakeGlobal.XMLHttpRequest = class {};
  fakeGlobal.navigator = {};
  Object.defineProperty(prototype, "location", { "get": () => ({}), "configurable": true });

  return fakeGlobal;
}

test("Strip Global: removes everything outside the allowlist, including prototypes", () => {
  const fakeGlobal = createFakeGlobal();
  const undeletable = stripGlobal(fakeGlobal, new Set(["Object", "console"]));

  expect(undeletable).toEqual([]);
  expect(Object.keys(fakeGlobal).sort()).toEqual(["Object", "console"]);
  expect(fakeGlobal.fetch).toBeUndefined();
  expect(fakeGlobal.XMLHttpRequest).toBeUndefined();
  expect(fakeGlobal.navigator).toBeUndefined();
  expect(fakeGlobal.postMessage).toBeUndefined();
  expect(fakeGlobal.addEventListener).toBeUndefined();
  expect(fakeGlobal.location).toBeUndefined();
});

test("Strip Global: tolerates undeletable primitives", () => {
  const fakeGlobal = createFakeGlobal();

  Object.defineProperty(fakeGlobal, "TEMPORARY", { "value": 0, "configurable": false });

  expect(stripGlobal(fakeGlobal, (new Set))).toEqual([]);
  expect(fakeGlobal.TEMPORARY).toBe(0);
});

test("Strip Global: reports undeletable objects, functions, and accessors", () => {
  const fakeGlobal = createFakeGlobal();

  Object.defineProperty(fakeGlobal, "lockedObject", { "value": {}, "configurable": false });
  Object.defineProperty(fakeGlobal, "lockedFunction", { "value": () => {}, "configurable": false });
  Object.defineProperty(Object.getPrototypeOf(fakeGlobal), "lockedAccessor", {
    "get"         : () => 0,
    "configurable": false,
  });

  expect(stripGlobal(fakeGlobal, (new Set)).sort()).toEqual([
    "lockedAccessor",
    "lockedFunction",
    "lockedObject",
  ]);
});
