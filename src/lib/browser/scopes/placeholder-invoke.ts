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

import { ApplicationNamespace } from "@/constants/application.ts";
import { LogInfo } from "@/constants/browser.ts";
import { readStoragePath } from "@/lib/browser/scopes/read-storage-path.ts";

export async function placeholderInvoke(
  command: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  options: unknown,
): Promise<unknown> {
  console.log(command, payload, options);

  switch (command) {
    case "get_executable_directory": {
      return "indexed_db";
    }
    case "get_launched_state": {
      return 0;
    }
    case "plugin:fs|exists": {
      return false;
    }
    case "plugin:fs|read_text_file": {
      const input: string = await readStoragePath(payload?.path);
      const encoder: TextEncoder = new TextEncoder;

      return encoder.encode(input);
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
      const hours: number = now.getHours();
      const minutes: string = now
        .getMinutes()
        .toString()
        .padStart(2, "0");
      const seconds: string = now
        .getSeconds()
        .toString()
        .padStart(2, "0");
      const milliseconds: string = now
        .getMilliseconds()
        .toString()
        .padStart(3, "0");
      const time: string = `${hours}:${minutes}:${seconds}:${milliseconds}`;
      const message: string =
        time + LogInfo.delimiter +
        LogInfo.levels[payload.level as 1] + LogInfo.delimiter +
        `webview:${payload.location}` + LogInfo.delimiter +
        payload.message;

      window[ApplicationNamespace].__internals.logsInBrowser?.push?.(message);

      return;
    }
    default: {
      return;
    }
  }
}