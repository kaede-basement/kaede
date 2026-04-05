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

const logInfo = {
  "delimiter": " | ",
  "levels"   : {
    "1": "TRACE",
    "2": "DEBUG",
    "3": "INFO",
    "4": "WARN",
    "5": "ERROR",
  },
} as const;

export async function placeholderInvoke(
  command: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  options: unknown,
): Promise<unknown> {
  console.log(command, payload, options);

  switch (command) {
    case "get_launched_state": {
      return 0;
    }
    case "plugin:fs|exists": {
      return false;
    }
    case "plugin:path|join": {
      const paths: Array<string> = payload?.paths ?? [];

      return paths.join("\\");
    }
    case "plugin:app|version": {
      return "0.0.0";
    }
    case "plugin:log|log": {
      const now: Date = new Date;
      const time: string =
        now.getHours() + ":" +
        now.getMinutes() + ":" +
        now.getSeconds() + "." +
        now.getMilliseconds();
      const message: string =
        time + logInfo.delimiter +
        logInfo.levels[payload.level as 1] + logInfo.delimiter +
        `webview:${payload.location}` + logInfo.delimiter +
        payload.message;

      window.__KAEDE__.__internals.logsInBrowser?.push?.(message);

      return;
    }
    default: {
      return;
    }
  }
}