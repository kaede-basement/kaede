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

import { mkdir } from "@tauri-apps/plugin-fs";

import FileManager from "@/lib/file-manager";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import Extractors from "@/lib/launcher/scopes/extractors";
import Fetching from "@/lib/launcher/scopes/fetching";
import Parsers from "@/lib/launcher/scopes/parsers";
import Patches from "@/lib/launcher/scopes/patches";
import { log } from "@/lib/logging/log.ts";
import { repairLegacyMrpack } from "@/lib/modrinth/install-mrpack.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LaunchResponseType } from "@/types/launcher/launch/launch-response.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";
import type { TranslationKey } from "@/types/translations/translations.type.ts";

import { settleDownloadStages } from "./fetching/settle-download-stages.ts";

type LaunchResult = LaunchResponseType & { "reason"?: TranslationKey | "cancelled" };

const failed: LaunchResponseType = {
  "success": false,
  "process": undefined,
};

const cancellations = new WeakMap<LauncherStatusesType, Promise<boolean>>;

export function cancelLaunchDownloads(statuses: LauncherStatusesType): Promise<boolean> {
  const requested = Fetching.cancelAll(`${statuses.instanceId}-download`);

  cancellations.set(statuses, requested);

  return requested;
}

export async function handleLaunch({
  instanceId,
  instance,
  statuses,
  userPreferences,
  onClose,
  onInput,
}: {
  "instanceId"     : string;
  "instance"       : InstanceStateType;
  "statuses"       : LauncherStatusesType;
  "userPreferences": PreLaunchInformationType["user"];
  "onClose"        : (instanceId: string) => void;
  "onInput"        : (lines: Array<string>) => void;
}): Promise<LaunchResult> {
  const logPrefix: string = `${instanceId}:${__PRE_BUNDLED_FILENAME__}`;
  const { instanceDirectory } = Instances.getMinecraftDirectory({
    "baseDirectory": FileManager.getBaseDirectory(),
    instanceId,
  });

  await mkdir(instanceDirectory, { "recursive": true });
  const necessaries: PreLaunchInformationType | false = Extractors.getNecessaries({
    instanceId,
    instance,
    statuses,
    userPreferences,
    logPrefix,
  });

  if (necessaries === false) {
    log.warn(
      // Same as 'necessaries.logPrefix'
      logPrefix,
      "Aborting the launch process due to an error in pre-launch information extraction",
    );

    return failed;
  }

  if (necessaries.directories.instance !== instanceDirectory) {
    await mkdir(necessaries.directories.instance, { "recursive": true });
  }

  log.info(logPrefix, log.templates.json.contents(
    "Pre-launch environment",
    {
      "platform" : necessaries.platform,
      "arch"     : necessaries.arch,
      "javaMajor": necessaries.user.javaMajor,
    },
    true,
  ));

  if (!necessaries.user.account) {
    return { ...failed, "reason": "general.launch-status.missing-account" };
  }

  if (instance.modpackPath) {
    try {
      await repairLegacyMrpack(instance, instanceId, instanceDirectory, statuses);
    } catch (error) {
      if (error === "Installation cancelled") {
        return { ...failed, "reason": "cancelled" };
      }

      log.error(logPrefix, "Could not repair legacy modpack", String(error));

      return { ...failed, "reason": "general.launch-status.repair-error" };
    }
  }

  const entryPatch: SpecificPatchMetaType | false = await Patches.resolvePatch({
    necessaries,
    "metadata": {
      "uid": instance.entry,
    },
  });

  if (entryPatch === false) {
    log.warn(
      necessaries.logPrefix,
      "Aborting the launch process due to an error in entry patch resolving",
    );

    return failed;
  }

  const allPatches: Array<SpecificPatchMetaType> = await Patches.resolveSubPatches({
    "patchMeta": entryPatch,
    necessaries,
  });
  const finalizedPatch: FinalizedPatchType = Parsers.finalizePatches({
    "patches": allPatches,
    necessaries,
  });

  log.info(
    necessaries.logPrefix,
    `Resolved ${allPatches.length} patches and ${finalizedPatch.artifacts.length} artifacts`,
  );

  const cancel = (): Promise<boolean> => Fetching.cancelAll(necessaries.cancelId);
  const downloaded = await settleDownloadStages(cancel, [
    (signal): Promise<boolean> => Fetching.downloadAssets({ necessaries, finalizedPatch, signal }),
    (signal): Promise<boolean> => Fetching.downloadClient({ necessaries, finalizedPatch, signal }),
    (signal): Promise<boolean> => Fetching.downloadLogging({ necessaries, finalizedPatch, signal }),
    async (signal): Promise<boolean> => {
      if (!await Fetching.downloadLibraries({ necessaries, finalizedPatch, signal })) {
        return false;
      }

      if (signal.aborted) {
        return false;
      }

      await Extractors.unzipNatives({
        necessaries,
        "paths": finalizedPatch.artifacts
          .filter(({ status }) => status === "native")
          .map(({ path, exclude }) => ({ path, "exclude": exclude ?? [] })),
      });

      return true;
    },
  ]).catch(error => {
    log.error(necessaries.logPrefix, "Artifact preparation failed:", String(error));

    return false;
  });

  if (!downloaded) {
    if (await cancellations.get(statuses)) {
      return { ...failed, "reason": "cancelled" };
    }

    log.warn(necessaries.logPrefix, "Aborting the launch after an artifact download failed");

    return { ...failed, "reason": "general.launch-status.artifact-error" };
  }

  const command: {
    "java"     : string;
    "arguments": Array<string>;
  } = await Launcher.createCommand({ necessaries, finalizedPatch });

  return Launcher.spawnMinecraft({
    command,
    instanceId,
    necessaries,
    onClose,
    onInput,
  });
}
