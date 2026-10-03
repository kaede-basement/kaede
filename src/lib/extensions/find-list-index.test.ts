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

import { findListIndex } from "@/lib/extensions/find-list-index.ts";

const list = [
  { "enabled": true, "sha256": "artifact-a", "label": "Plugin (plugin)" },
];

test("finds the entry of the same artifact", () => {
  expect(findListIndex(list, { "artifactSha256": "artifact-a" })).toBe(0);
});

test("does not treat the same code with other metadata as already enabled", () => {
  const replacedMetadata = { "codeSha256": "artifact-a", "artifactSha256": "artifact-b" };

  expect(findListIndex(list, replacedMetadata)).toBe(-1);
});
