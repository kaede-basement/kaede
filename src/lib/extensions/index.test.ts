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

import { GlobalInternals } from "@/extendable/global-internals.ts";
import Extensions from "@/lib/extensions";

test("permission requests reach the handler installed after the module loaded", async () => {
  const installed = GlobalInternals.requestPermissions;
  const calls: Array<Array<unknown>> = [];

  GlobalInternals.requestPermissions = async (...parameters): Promise<Array<unknown>> => {
    calls.push(parameters);

    return ["granted"];
  };

  try {
    const result = await Extensions.requestPermissions(["time::date"], "plugin", "artifact");

    expect(result).toEqual(["granted"]);
    expect(calls).toEqual([[["time::date"], "plugin", "artifact"]]);
  } finally {
    GlobalInternals.requestPermissions = installed;
  }
});
