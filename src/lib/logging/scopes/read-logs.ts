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

import { readTextFile } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export async function readLogs({
  globalStates,
}: {
  "globalStates": GlobalStatesType | undefined;
}): Promise<{
  "size": string;
  "logs": Array<string>;
}> {
  log.debug(__PRE_BUNDLED_FILENAME__, "Mounted the component");
  const latestLogAbsolutePath = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Folders.Logs.Path,
    FileStructure.Folders.Logs.Files.LatestLog,
  );

  log.debug(__PRE_BUNDLED_FILENAME__, "Reading 'latest.log' file");
  const existingLogs: string = await readTextFile(latestLogAbsolutePath);

  if (existingLogs === "") {
    log.warn(__PRE_BUNDLED_FILENAME__, "Log file is empty");

    return {
      "size": "0",
      "logs": ["__kaede-trigger-initial"],
    };
  }

  // If the log file is big (>=32 KBs), open it with the virtualized list
  if (existingLogs.length >= 32_768) {
    log.debug(`Log file is too big (${existingLogs.length} bytes), using a virtualized list`);
    GlobalStateHelpers.Logs.toggle("virtualized", true);
  }

  const filesize = (existingLogs.length / (1024 * 1024)).toFixed(3);

  log.info(__PRE_BUNDLED_FILENAME__, "Log file is not empty");
  log.debug(__PRE_BUNDLED_FILENAME__, "Adding existing logs to the 'logs' state");

  return {
    "size": filesize,
    "logs": [
      globalStates?.logs?.virtualized ? "__kaede-trigger-virtualized" : "__kaede-trigger-initial",
      ...existingLogs.split("\n"),
    ],
  };
}
