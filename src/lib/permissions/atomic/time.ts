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

import "ses";

import { hardenIfAvailable } from "@/lib/permissions/harden.ts";

const wrappedPerformance = {
  "timeOrigin": performance.timeOrigin,
  "now"       : (): number => performance.now(),
};

const dateReferences = new WeakMap<wrappedDate, Date>;

function getDateReference(input: wrappedDate): Date {
  const current: Date | undefined = dateReferences.get(input);

  if (!current) {
    throw new Error("The provided 'Date' is unregistered in the host references");
  }

  return current;
}

class wrappedDate {
  public static now(): number {
    return Date.now();
  }

  public static parse(input: unknown): number {
    if (typeof input !== "string") {
      throw new TypeError("The input for 'Date#parse' should be a string");
    }

    return Date.parse(input);
  }

  public static UTC(
    year?: unknown,
    monthIndex?: unknown,
    date?: unknown,
    hours?: unknown,
    minutes?: unknown,
    seconds?: unknown,
    ms?: unknown,
  ): number {
    const toValidate = [year, monthIndex, date, hours, minutes, seconds, ms];
    const validated: Array<number | undefined> = [];

    for (const current of toValidate) {
      const isNumber = typeof current === "number" && !Number.isNaN(current);

      if (isNumber || current === undefined) {
        // It's okay if we have an undefined value since it might mean the argument isn't present
        validated.push(current);

        continue;
      }

      throw new TypeError("The input for 'Date#UTC' should be a number");
    }

    return Date.UTC(
      ...(validated as [number, number, number, number, number, number, number]),
    );
  }

  constructor(input: unknown) {
    if (input === undefined) {
      dateReferences.set(this, new Date);

      return;
    }

    if (
      (typeof input === "number" && !Number.isNaN(input)) ||
      typeof input === "string"
    ) {
      dateReferences.set(this, new Date(input));

      return;
    }

    if (input instanceof wrappedDate) {
      const absolute: number = getDateReference(input).valueOf();

      dateReferences.set(this, new Date(absolute));

      return;
    }

    throw new TypeError("The input for the 'Date' constructor is invalid");
  }
}
for (const method of [
  "valueOf",
  "getDate",
  "getDay",
  "getFullYear",
  "getHours",
  "getMilliseconds",
  "getMinutes",
  "getMonth",
  "getSeconds",
  "getTime",
  "getTimezoneOffset",
  "getUTCDate",
  "getUTCDay",
  "getUTCFullYear",
  "getUTCHours",
  "getUTCMilliseconds",
  "getUTCMinutes",
  "getUTCMonth",
  "getUTCSeconds",
  "toString",
  "toTimeString",
  "toUTCString",
  "toJSON",
  "toDateString",
  "toISOString",
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
] as const) {
  Object.defineProperty(wrappedDate.prototype, method, {
    value(this: wrappedDate) {
      return getDateReference(this)[method]();
    },
  });
}

export function handleTimePermission({
  scope,
}: {
  "id"   : string;
  "scope": "performance" | "date";
}): unknown {
  switch (scope) {
    case "performance": {
      return hardenIfAvailable({
        "performance": wrappedPerformance,
      });
    }
    case "date": {
      return hardenIfAvailable({
        "Date": wrappedDate,
      });
    }
  }
}
