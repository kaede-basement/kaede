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

import { mock } from "bun:test";

const writeableThis = globalThis as unknown as Record<string, unknown>;

writeableThis.__PRE_BUNDLED_FILENAME__ = "bun-test:0";

// @ts-expect-error '.ts' imports work properly, but the error persists because no tsconfig is used
const { "default": logging } = await import("../src/__mocks__/log.ts");
// @ts-expect-error '.ts' imports work properly, but the error persists because no tsconfig is used
const { "default": windowApi } = await import("../src/__mocks__/api/window.ts");

mock.module("@/lib/logging/log.ts", () => logging);
mock.module("@tauri-apps/api/window", () => windowApi);
