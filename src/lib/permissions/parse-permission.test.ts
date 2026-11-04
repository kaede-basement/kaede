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

import { parsePermission } from "@/lib/permissions/parse-permission.ts";

test("Parse Permission: accepts known permissions", () => {
  expect(parsePermission("log::write")).toEqual({ "key": "log::write", "argument": undefined });
  expect(parsePermission("internet::http-get::http://[::1]:8080/a")).toEqual({
    "key"     : "internet::http-get",
    "argument": "http://[::1]:8080/a",
  });
});

test("Parse Permission: rejects unknown permissions and wrong arguments", () => {
  for (const permission of [
    undefined,
    {},
    "log",
    "log::",
    "log::writer",
    "time::performanceLOL",
    "log::write::",
    "log::write::extra",
    "internet::http-get",
    "internet::http-get::",
    "internet::http-get::not a url",
  ]) {
    expect(parsePermission(permission)).toBeUndefined();
  }
});
