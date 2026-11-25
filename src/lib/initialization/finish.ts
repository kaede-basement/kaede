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

import { invoke } from "@tauri-apps/api/core";

import FileStructure from "@/constants/file-structure.ts";
import { FamousAndOldJavaMajorVersion } from "@/constants/launcher.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { log } from "@/lib/logging/log.ts";

type FinalizedType = {
  "createdDirectories": Array<string>;
  "javaMajor"         : number | null;

  /*
   * "release-file" (JVM was not spawned)
   * "spawn" (JVM was spawned)
   * "unresolved" (returns None)
   */
  "javaMajorSource": "release-file" | "spawn" | "unresolved";
};

export async function finish({
  baseDirectory,
}: {
  "baseDirectory": string;
}): Promise<void> {
  GlobalInternals.javaMajor = FamousAndOldJavaMajorVersion;

  const report: FinalizedType = await invoke("finalize_initialization", {
    baseDirectory,
    "folders"   : Object.values(FileStructure.Folders).map(({ Path }) => Path),
    "javaBinary": "java",
  });

  GlobalInternals.javaMajor = report.javaMajor ?? FamousAndOldJavaMajorVersion;

  log.info(
    __PRE_BUNDLED_FILENAME__,
    "Launcher successfully initialized in:",
    performance.now().toFixed(1),
    "ms",
    "\n",
    `Default java major: '${report.javaMajor ?? "unknown"}' (got by '${report.javaMajorSource}');`,
    report.createdDirectories.length === 0
      ? "all launcher directories are present"
      : `created directories: ${report.createdDirectories.join(", ")}`,
  );
}
