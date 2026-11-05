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

import { bench, type k_iter, type k_state, run, summary } from "mitata";

import { sanitizeFileOrFolderName } from "./path.ts";

/*
 * V8 engine is faster than JavaScriptCore for big strings (6.88 µs/iter vs 14.91 µs/iter),
 * but slower for small strings (107.51 ns/iter vs 79.02 ns/iter)
 */
summary((): void => {
  bench("sanitizeFileOrFolderName() for $input", function* (state: k_iter & k_state) {
    const current = state.get("input");

    yield {
      [0](): string {
        return current + Math.floor(Math.random() * 10);
      },
      bench(current: string): void {
        sanitizeFileOrFolderName(current);
      },
    };
  }).args("input", [
    "hi.ts",
    "@stylistic/generator-star-spacing",
    "\n⣿⣗⡷⠟⣃⢟⣾⣿⣿⣿⢯⣾⣿⡿⣳⢞⣕⣼⡿⢹⣿⣿⣷⣹⣿" +
    "\n⣿⣿⢁⢜⢅⣾⣿⣿⡿⣱⢟⣽⠟⣼⢯⡟⣾⣟⡅⣼⣿⣿⣿⣿⣿" +
    "\n⣿⡇⣴⢏⣾⣿⣿⡿⠱⡻⣋⢋⣚⢓⡿⢼⡿⣽⢣⣿⣿⣿⣿⣿⣿" +
    "\n⠛⣣⠇⣸⣿⣿⣿⠃⡸⣧⣣⣿⣿⣼⣧⣿⢣⣟⣼⣿⣿⣿⣿⣿⣿" +
    "\n⡉⣡⢤⣿⣿⣿⡏⠐⣫⣾⣿⣿⣿⣿⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿" +
    "\n⢈⠥⣸⣿⣿⡟⠠⠾⣿⡻⣿⣿⣿⣿⣯⣿⣿⣿⣿⣿⣿⣿⣿⣯⣿" +
    "\n⣿⣇⣿⣿⡏⡇⠶⠤⠀⠉⠓⠻⣿⣿⣿⣿⣿⣿⣿⣾⣿⣿⣿⣿⣿" +
    "\n⡸⣿⣿⣿⣇⢸⣷⣶⣶⣶⣶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿" +
    "\n⡗⣿⣿⣿⣻⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⡀⠀⢈⣉⡉⣹⣿" +
    "\n⣽⣿⣿⣿⠁⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡄⠈⣤⠋⣿" +
    "\n⣼⣿⣿⣿⠀⠀⣿⣿⣿⣿⢱⠶⣭⡝⠛⣿⣿⣿⣿⣿⡟⡀⣿⣷⡹" +
    "\n⣿⣿⣿⣿⠂⢀⣮⣻⢿⣿⣮⣙⣓⣩⣴⣿⣿⣿⣿⢏⠠⠱⣿⣿⣷" +
    "\n⣿⣿⣿⣿⠀⠸⠹⠿⣷⣝⠿⢿⣿⡿⠿⠿⠛⠫⣔⢨⠀⣸⣟⣿⣿",
  ]);
});

await run();
