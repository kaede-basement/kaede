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
  if (!input) {
    return [];
  }

  const parts: Array<string> = [];
  const currentSimpleArgument: Array<string> = [];
  const currentQuotedArgument: Array<string> = [];
  let isInQuotes: boolean = false;

  for (const character of input) {
    // We have stumbled upon a double-quoted argument
    if (character === "\"") {
      // The end of the argument
      if (isInQuotes) {
        const resultedArgument: string = currentQuotedArgument.join("");

        currentQuotedArgument.length = 0;
        parts.push(resultedArgument);

        continue;
      }

      // The start of the argument
      isInQuotes = true;

      continue;
    }

    // Keep pushing even the spaces
    if (isInQuotes) {
      currentQuotedArgument.push(character);

      continue;
    }

    // Non-double-quoted arguments
    if (character === " ") {
      const resultedArgument: string = currentSimpleArgument.join("");

      currentSimpleArgument.length = 0;
      parts.push(resultedArgument);

      continue;
    }

    currentSimpleArgument.push(character);
  }

  // The final argument have not been added yet
  if (currentSimpleArgument.length > 0) {
    const resultedArgument: string = currentSimpleArgument.join("");

    parts.push(resultedArgument);
  }

  return parts
    // Filter out empty strings
    .filter(part => part !== "");
}