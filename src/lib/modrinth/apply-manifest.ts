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

import { InstallablePatches, Patches } from "@/constants/meta.ts";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import { setImportedModpack } from "@/lib/modrinth/import-archive.ts";
import Modrinth from "@/lib/modrinth/index.ts";
import { globalStates } from "@/states/global.ts";
import type { MrpackManifestType } from "@/types/modrinth/mrpack.type.ts";

export function applyManifest({
  manifest,
  path,
}: {
  "manifest": MrpackManifestType | undefined;
  "path"    : string;
}): void {
  if (!manifest) {
    if (globalStates.pages["add-instance"].importedModpack) {
      Instances.resetPageStates();
    }

    return;
  }

  const patchVersions = Modrinth.resolvePatchVersions(manifest.dependencies);
  const currentInstance = Instances.extractSavedFromPages(
    globalStates.pages?.["add-instance"]?.instance,
    globalStates.minecraft,
  );

  if (patchVersions === undefined) {
    log.warn(
      __PRE_BUNDLED_FILENAME__,
      `'${manifest.name}' declares no Minecraft version; keeping the selected one`,
    );
  }

  if (!currentInstance) {
    return log.error(__PRE_BUNDLED_FILENAME__, "No current instance returned");
  }

  const versions = patchVersions ?? currentInstance.patchVersions;
  const loader = InstallablePatches.find(({ uid }) => (
    uid !== Patches.Minecraft && versions[uid] !== undefined
  ))?.uid ?? Patches.Minecraft;
  const page = globalStates.pages["add-instance"];

  setImportedModpack({ path, "name": manifest.name, loader });
  page.instance = {
    ...currentInstance, "name": manifest.name || currentInstance.name, "patchVersions": versions,
  };
  page.instanceVersionSearch = { "input": "", "patch": loader };
  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Got '${manifest.name}' (${manifest.versionId}) that indexes ${manifest.files.length} files`,
  );
}