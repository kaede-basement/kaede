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

import * as core from "@tauri-apps/api/core";
import { expect, spyOn, test } from "bun:test";

import { toProcessHandle } from "./core.ts";

test("process handles send their token when killing and writing", async () => {
  const pid = 42;
  const token = "current";
  const handle = toProcessHandle({ pid, token, "kind": "test", "meta": null });
  const invoke = spyOn(core, "invoke").mockResolvedValue(null);

  try {
    await handle.write(new Uint8Array([73]));
    await handle.kill();
    expect(invoke.mock.calls).toEqual([
      ["write_process", { pid, token, "data": [73] }],
      ["kill_process", { pid, token }],
    ]);
  } finally {
    invoke.mockRestore();
  }
});
