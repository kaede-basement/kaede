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

import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import { PatchUIDs } from "@/constants/meta.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function ensurePatchDirectories(
  necessaries: PreLaunchInformationType,
): Promise<void> {
  const { directories, logPrefix } = necessaries;

  log.debug(
    logPrefix,
    `Checking if ${PatchUIDs.length} patch directories exist`,
  );
  const existStatuses: Array<boolean> = await Promise.all(
    PatchUIDs.map(uid => exists(
      General.cachedJoin(
        directories.base,
        FileStructure.Folders.Cache.Path,
        uid,
      ),
    )),
  );
  const toCreate: Array<string> = [];

  for (const [index, status] of existStatuses.entries()) {
    if (status) {
      continue;
    }

    toCreate.push(
      General.cachedJoin(
        directories.base,
        FileStructure.Folders.Cache.Path,
        PatchUIDs[index],
      ),
    );
  }

  log.debug(
    logPrefix,
    `Missing patch directories: ${toCreate.join(", ")}`,
  );
  await Promise.all(
    toCreate.map(path => mkdir(path)),
  );
}
