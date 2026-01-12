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
import type { ShallowReactive } from "vue";

import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export async function readLogs({
  globalStates,
  instanceLogs,
}: {
  "globalStates": GlobalStatesType | undefined;
  "instanceLogs": ShallowReactive<Record<string, string[]>> | undefined;
}): Promise<{
  "size": string;
  "logs": Array<string>;
}> {
  log.debug(__PRE_BUNDLED_FILENAME__, "Mounted the component");
  const currentMode: "launcher" | string = globalStates?.logs?.mode ?? "launcher";
  const latestLogAbsolutePath = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Folders.Logs.Path,
    FileStructure.Folders.Logs.Files.LatestLog,
  );

  let storedLogs: string = "none";
  let existingLogs: Array<string>;

  if (currentMode === "launcher") {
    log.debug(__PRE_BUNDLED_FILENAME__, "Reading 'latest.log' file");

    /*
     * If the stored logs are actually empty,
     * the 'storedLogs' variable will be overwritten to an empty string
     */
    storedLogs = await readTextFile(latestLogAbsolutePath);
    existingLogs = storedLogs.split("\n");
  } else {
    log.debug(__PRE_BUNDLED_FILENAME__, `Reading the '${currentMode}' instance logs`);
    existingLogs = instanceLogs?.[currentMode] ?? [];
  }

  if (storedLogs === "") {
    log.warn(__PRE_BUNDLED_FILENAME__, "Log file is empty");

    return {
      "size": "0",
      "logs": ["__kaede-trigger-initial"],
    };
  }

  // If the log file is big (>=32 KBs), open it with the virtualized list
  if (storedLogs.length >= 32_768) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      `Log file is too big (${storedLogs.length} bytes), using a virtualized list`,
    );
    GlobalStateHelpers.Logs.toggle("virtualized", true);
  }

  const filesize = (storedLogs.length / (1024 * 1024)).toFixed(3);

  log.info(__PRE_BUNDLED_FILENAME__, "Log file is not empty");
  log.debug(__PRE_BUNDLED_FILENAME__, "Adding existing logs to the 'logs' state");

  /*
   * Only add the placeholder if the logs array does not have it.
   * The reason for this is that in case with the instance logs,
   * we manipulate an existing array without cloning it.
   */
  if (!existingLogs?.[0]?.startsWith?.("__kaede")) {
    existingLogs.unshift(
      globalStates?.logs?.virtualized
        ? "__kaede-trigger-virtualized"
        : "__kaede-trigger-initial",
    );
  }

  return {
    "size": filesize,
    "logs": existingLogs,
  };
}
