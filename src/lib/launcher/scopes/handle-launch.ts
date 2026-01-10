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

import { createCommand } from "@/lib/launcher/scopes/create-command.ts";
import { extractNativeArchives } from "@/lib/launcher/scopes/extractors/extract-native-archives.ts";
import {
  extractPreLaunchInformation,
} from "@/lib/launcher/scopes/extractors/extract-pre-launch-information.ts";
import { downloadAssets } from "@/lib/launcher/scopes/fetching/download-assets.ts";
import { downloadClient } from "@/lib/launcher/scopes/fetching/download-client.ts";
import { downloadLibraries } from "@/lib/launcher/scopes/fetching/download-libraries.ts";
import { downloadLogging } from "@/lib/launcher/scopes/fetching/download-logging.ts";
import { finalizePatches } from "@/lib/launcher/scopes/parsers/finalize-patches.ts";
import { resolvePatch } from "@/lib/launcher/scopes/patches/resolve-patch.ts";
import { resolveSubPatches } from "@/lib/launcher/scopes/patches/resolve-sub-patches.ts";
import { spawnMinecraft } from "@/lib/launcher/scopes/spawn-minecraft.ts";
import {
  ensureMinecraftDirectory,
} from "@/lib/launcher/scopes/validators/ensure-minecraft-directory.ts";
import {
  ensurePatchDirectories,
} from "@/lib/launcher/scopes/validators/ensure-patch-directories.ts";
import {
  initializeAssetsDirectories,
} from "@/lib/launcher/scopes/version-meta/assets/initialize-assets-directories.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LaunchResponseType } from "@/types/launcher/launch/launch-response.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

const failed: LaunchResponseType = {
  "success": false,
  "process": undefined,
};

export async function handleLaunch({
  instanceId,
  instance,
  statuses,
  userPreferences,
  onClose,
}: {
  "instanceId"     : string;
  "instance"       : InstanceStateType;
  "statuses"       : LauncherStatusesType;
  "userPreferences": PreLaunchInformationType["user"];
  "onClose"        : (instanceId: string) => void;
}): Promise<LaunchResponseType> {
  const necessaries: PreLaunchInformationType | false = extractPreLaunchInformation({
    instanceId,
    instance,
    statuses,
    userPreferences,
  });

  log.info(
    __PRE_BUNDLED_FILENAME__,
    log.templates.json.contents("Pre-launch information", necessaries),
  );

  if (necessaries === false) {
    log.warn(
      __PRE_BUNDLED_FILENAME__,
      "Aborting the launch process due to an error in pre-launch information extraction",
    );

    return failed;
  }

  await Promise.all([
    ensurePatchDirectories(necessaries),
    ensureMinecraftDirectory(necessaries),
    initializeAssetsDirectories(necessaries),
  ]);

  const entryPatch: SpecificPatchMetaType | false = await resolvePatch({
    necessaries,
    "metadata": {
      "uid": instance.entry,
    },
  });

  if (entryPatch === false) {
    log.warn(
      __PRE_BUNDLED_FILENAME__,
      "Aborting the launch process due to an error in entry patch resolving",
    );

    return failed;
  }

  const allPatches: Array<SpecificPatchMetaType> = await resolveSubPatches({
    "patchMeta": entryPatch,
    necessaries,
  });
  const finalizedPatch: FinalizedPatchType = finalizePatches({
    "patches": allPatches,
    necessaries,
  });

  log.info(
    __PRE_BUNDLED_FILENAME__,
    log.templates.json.contents(
      "Finalized patch",
      {
        ...finalizedPatch,
        "artifacts": "[ ... ] (" + finalizedPatch.artifacts.length + " entries)",
      },
    ),
  );

  const responses: Array<boolean> = await Promise.all([
    downloadAssets({ necessaries, finalizedPatch }),
    downloadClient({ necessaries, finalizedPatch }),
    downloadLogging({ necessaries, finalizedPatch }),
    downloadLibraries({ necessaries, finalizedPatch }),
  ]);

  for (const status of responses) {
    if (!status) {
      log.warn(
        __PRE_BUNDLED_FILENAME__,
        "Aborting the launch process due to an error in artifact downloads",
      );

      return failed;
    }
  }

  const [command]: [{
    "program"  : string;
    "arguments": string;
  }, void] = await Promise.all([
    createCommand({ necessaries, finalizedPatch }),
    extractNativeArchives({
      necessaries,
      "paths": finalizedPatch
        .artifacts
        .filter(({ status }) => status === "native")
        .map(({ path }) => path),
    }),
  ]);

  return spawnMinecraft({
    command,
    instanceId,
    necessaries,
    onClose,
  });
}
