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

export function splitArguments(input: string | undefined): Array<string> {
  const parts: Array<string> = [];
  let current = "";
  let quoted = false;
  let started = false;
  let slashes = 0;

  for (const character of input ?? "") {
    if (character === "\\") {
      slashes++;
      started = true;
      continue;
    }

    if (character === "\"") {
      current += "\\".repeat(Math.floor(slashes / 2));
      if (slashes % 2 === 1) {
        current += "\"";
      } else {
        quoted = !quoted;
      }
      started = true;
    } else {
      current += "\\".repeat(slashes);
      if (!quoted && (/\s/).test(character)) {
        if (started) {
          parts.push(current);
        }
        current = "";
        started = false;
      } else {
        current += character;
        started = true;
      }
    }
    slashes = 0;
  }

  if (started) {
    parts.push(current + "\\".repeat(slashes));
  }

  return parts;
}
