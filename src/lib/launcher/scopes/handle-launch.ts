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

import { LaunchStatus } from "@/constants/launcher.ts";
import FileManager from "@/lib/file-manager";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import Extractors from "@/lib/launcher/scopes/extractors";
import Fetching from "@/lib/launcher/scopes/fetching";
import Parsers from "@/lib/launcher/scopes/parsers";
import Patches from "@/lib/launcher/scopes/patches";
import { log } from "@/lib/logging/log.ts";
import { repairLegacyMrpack } from "@/lib/modrinth/install-mrpack.ts";
import { hasActiveDownloads } from "@/lib/network/native-download.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LaunchResponseType } from "@/types/launcher/launch/launch-response.type.ts";
import type {
  LauncherStatusesType, LaunchStatusType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

import {
  ArtifactDownloadFailure,
  beginLaunchAttempt,
  CancelledDownload,
  checkDownloadSignal,
  launchAttempts,
} from "./fetching/download-outcome.ts";
import { settleDownloadStages } from "./fetching/settle-download-stages.ts";

type LaunchResult = LaunchResponseType & { "reason"?: LaunchStatusType | "cancelled" };

const failed: LaunchResponseType = {
  "success": false,
  "process": undefined,
};

function cancelActiveDownloads(id: string): Promise<boolean> {
  return hasActiveDownloads(id) ? Fetching.cancelAll(id) : Promise.resolve(false);
}

export function cancelLaunchDownloads(statuses: LauncherStatusesType): Promise<boolean> {
  const attempt = launchAttempts.get(statuses);

  if (!attempt) {
    return Promise.resolve(false);
  }

  attempt.abort(new CancelledDownload);

  return cancelActiveDownloads(attempt.cancelId);
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
}, attempt = beginLaunchAttempt(statuses)): Promise<LaunchResult> {
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
    return { ...failed, "reason": LaunchStatus.Errors.MissingAccount };
  }

  if (attempt.signal.aborted) return { ...failed, "reason": "cancelled" };

  if (instance.modpackPath) {
    try {
      await repairLegacyMrpack(instance, instanceId, instanceDirectory, statuses);
    } catch (error) {
      if (error === "Installation cancelled") {
        return { ...failed, "reason": "cancelled" };
      }

      log.error(logPrefix, "Could not repair legacy modpack", String(error));

      return { ...failed, "reason": LaunchStatus.Errors.Repair };
    }
  }

  if (attempt.signal.aborted) {
    return { ...failed, "reason": "cancelled" };
  }
  let allPatches: Array<SpecificPatchMetaType>;

  try {
    const entryPatch = await Patches.resolvePatch({
      necessaries,
      "signal"  : attempt.signal,
      "metadata": { "uid": instance.entry },
    });

    checkDownloadSignal(attempt.signal);
    if (!entryPatch) {
      return failed;
    }
    allPatches = await Patches.resolveSubPatches({
      "patchMeta": entryPatch, necessaries, "signal": attempt.signal,
    });
  } catch (error) {
    if (error instanceof ArtifactDownloadFailure) {
      return { ...failed, "reason": LaunchStatus.Errors.Artifact };
    }
    if (error instanceof CancelledDownload && attempt.signal.reason instanceof CancelledDownload) {
      return { ...failed, "reason": "cancelled" };
    }
    throw error;
  }
  if (attempt.signal.aborted) {
    return { ...failed, "reason": "cancelled" };
  }
  const finalizedPatch: FinalizedPatchType = Parsers.finalizePatches({
    "patches": allPatches,
    necessaries,
  });

  log.info(
    necessaries.logPrefix,
    `Resolved ${allPatches.length} patches and ${finalizedPatch.artifacts.length} artifacts`,
  );

  let failureReason: LaunchStatusType | "cancelled" = LaunchStatus.Errors.Artifact;
  const cancel = (): Promise<boolean> => cancelActiveDownloads(attempt.cancelId);
  const downloaded = await settleDownloadStages(cancel, [
    (signal): Promise<boolean> => Fetching.downloadAssets({ necessaries, finalizedPatch, signal }),
    (signal): Promise<boolean> => Fetching.downloadClient({ necessaries, finalizedPatch, signal }),
    (signal): Promise<boolean> => Fetching.downloadLogging({ necessaries, finalizedPatch, signal }),
    async (signal): Promise<boolean> => {
      if (!await Fetching.downloadLibraries({ necessaries, finalizedPatch, signal })) {
        return false;
      }

      if (signal.aborted) {
        throw (new CancelledDownload);
      }

      await Extractors.unzipNatives({
        necessaries,
        "paths": finalizedPatch.artifacts
          .filter(({ status }) => status === "native")
          .map(({ path, exclude }) => ({ path, "exclude": exclude ?? [] })),
      }).catch(error => {
        if (!signal.aborted) {
          failureReason = LaunchStatus.Errors.Native;
        }
        throw error;
      });

      return true;
    },
  ], attempt).catch(error => {
    if (error instanceof CancelledDownload && attempt.signal.reason instanceof CancelledDownload) {
      failureReason = "cancelled";
    }
    log.error(necessaries.logPrefix, "Artifact preparation failed:", String(error));

    return false;
  });

  if (!downloaded) {
    log.warn(necessaries.logPrefix, "Aborting the launch after artifact preparation failed");

    return { ...failed, "reason": failureReason };
  }

  if (attempt.signal.aborted) {
    return { ...failed, "reason": "cancelled" };
  }
  const command: {
    "java"     : string;
    "arguments": Array<string>;
  } = await Launcher.createCommand({ necessaries, finalizedPatch });

  if (attempt.signal.aborted) {
    return { ...failed, "reason": "cancelled" };
  }

  return Launcher.spawnMinecraft({
    command,
    instanceId,
    necessaries,
    onClose,
    onInput,
  });
}
