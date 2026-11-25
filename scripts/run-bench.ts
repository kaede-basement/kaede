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

import { execSync } from "node:child_process";
import { glob } from "node:fs";

glob("src/**/*.bench.ts", (error, matches) => {
  if (error) {
    throw error;
  }

  for (const match of matches) {
    /*
     * It is extremely inconvenient to use 'tsx' or 'node' as they always fail on
     * unsupported file extensions, like '.webp', when importing functions from the
     * Kaede source code, and I could not make a proper loader for this, so we just
     * use 'bun' with JavaScriptCore. V8 is faster and a better representation for
     * the WebView performance in Windows, but... whatever.
     */
    execSync(`bun --preload ./scripts/setup-tests.ts ${match}`, { "stdio": "inherit" });
  }
});
