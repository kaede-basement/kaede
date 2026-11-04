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

/**
 * Builds the global 'Date' of a plugin without the 'time::date' permission:
 * reading the current time throws, other uses work. This is a courtesy, not a boundary,
 * since timers and 'Intl.DateTimeFormat#format' still reveal the time.
 *
 * @param OriginalDate - the worker's own 'Date', captured before the plugin runs
 * @returns a 'Date' constructor that shares the original prototype
 */
export function tameDate(OriginalDate: DateConstructor): DateConstructor {
  const TamedDate = function (this: unknown, ...input: Array<unknown>): unknown {
    if (new.target === undefined) {
      throw new TypeError("Calling 'Date()' requires the 'time::date' permission");
    }

    if (input.length === 0) {
      throw new TypeError(
        "Calling 'new Date()' without arguments requires the 'time::date' permission",
      );
    }

    return Reflect.construct(OriginalDate, input, new.target);
  };

  Object.defineProperties(TamedDate, {
    "name"     : { "value": "Date" },
    "length"   : { "value": 7 },
    "prototype": { "value": OriginalDate.prototype },
    "parse"    : { "value": OriginalDate.parse, "writable": true, "configurable": true },
    "UTC"      : { "value": OriginalDate.UTC, "writable": true, "configurable": true },
    "now"      : {
      "value": (): number => {
        throw new TypeError("Calling 'Date.now()' requires the 'time::date' permission");
      },
      "writable"    : true,
      "configurable": true,
    },
  });

  // Otherwise 'new Date(0).constructor' would lead back to the original
  Object.defineProperty(OriginalDate.prototype, "constructor", {
    "value"       : TamedDate,
    "writable"    : true,
    "configurable": true,
  });

  return TamedDate as unknown as DateConstructor;
}
