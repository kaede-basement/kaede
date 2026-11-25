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

import {
  exists,
  type FileInfo,
  mkdir,
  readTextFile,
  stat,
} from "@tauri-apps/plugin-fs";

import Errors from "@/lib/errors";
import { join } from "@/lib/file-manager/path.ts";
import { publishText } from "@/lib/file-manager/publish-text.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/log.ts";

export async function handleJsonFile({
  baseDirectory,
  path,
  label,
  getDefaultValue,
  invalidation,
  stateFile,
  corrupt,
}: {
  "baseDirectory"  : string;
  "path"           : Array<string>;
  "label"          : string;
  "getDefaultValue": () => Promise<unknown>;
  "stateFile"?     : "accounts" | "instances";
  "corrupt"?       : boolean;
  "invalidation"  ?: {
    "days"       : number;
    "getNewValue": () => Promise<unknown>;
  };
}): Promise<unknown> {
  const filePath: string = join(baseDirectory, ...path);
  let stale = false;

  if (invalidation) {
    try {
      const info: FileInfo = await stat(filePath);

      stale = !info.mtime || General.checkDaysDifference(info.mtime, new Date) > invalidation.days;
    } catch (error) {
      // Another launch may publish the file between this stat and the read.
      log.debug(__PRE_BUNDLED_FILENAME__, `Could not stat '${label}':`, Errors.prettify(error));
    }
  }

  try {
    if (!stale && !corrupt) {
      return JSON.parse(await readTextFile(filePath));
    }
  } catch (error) {
    corrupt = error instanceof SyntaxError;
    if (!corrupt && await exists(filePath)) {
      return JSON.parse(await readTextFile(filePath));
    }
    log.debug(__PRE_BUNDLED_FILENAME__, `Could not read '${label}':`, Errors.prettify(error));
  }

  const value = stale && invalidation ? await invalidation.getNewValue() : await getDefaultValue();

  await mkdir(join(baseDirectory, ...path.slice(0, -1)), { "recursive": true });
  await publishText(
    filePath,
    JSON.stringify(value ?? null, null, 2),
    stateFile === "accounts",
    !!stateFile && corrupt,
  );

  return value;
}
