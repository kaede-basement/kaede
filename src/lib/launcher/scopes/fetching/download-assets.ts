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

import { APIEndpoints, GeneralSettings, LaunchStatus } from "@/constants/launcher.ts";
import { publish, safeComponent } from "@/lib/cache/storage.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { readLaunchMetadata } from "@/lib/launcher/scopes/fetching/fetch-metadata.ts";
import { log } from "@/lib/logging/log.ts";
import type { AssetObjectsType } from "@/types/launcher/artifacts/asset-objects.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchAssetIndexType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

import { downloadMissing } from "./download-missing.ts";

function validAssets(value: unknown): value is AssetObjectsType {
  if (!value || typeof value !== "object" || !("objects" in value) || !value.objects
    || typeof value.objects !== "object" || Array.isArray(value.objects)) return false;

  return Object.values(value.objects).every(entry => typeof entry?.hash === "string"
    && (/^[a-f0-9]{40}$/).test(entry.hash) && Number.isSafeInteger(entry.size) && entry.size >= 0);
}

export async function downloadAssets({
  necessaries,
  finalizedPatch,
  signal,
}: {
  "signal"?       : AbortSignal;
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  if (signal?.aborted) {
    return false;
  }

  const { directories, statuses, instance, logPrefix, cancelId } = necessaries;

  log.debug(logPrefix, "Getting the assetIndex metadata");
  if (
    finalizedPatch.assetIndex === undefined ||
    finalizedPatch.assetIndex?.id === undefined ||
    finalizedPatch.assetIndex?.url === undefined
  ) {
    log.error(logPrefix, "The finalized patch is missing assetIndex metadata");
    statuses.current = LaunchStatus.AssetIndex.FailedToGet;

    return false;
  }

  const assetIndex: SpecificPatchAssetIndexType = finalizedPatch.assetIndex;
  const metaFilename = assetIndex.id + ".json";

  if (!safeComponent(assetIndex.id)) {
    statuses.current = LaunchStatus.AssetIndex.FailedToValidate;

    return false;
  }
  const index = await readLaunchMetadata("AssetIndex", necessaries, {
    "relativePath": "asset-indexes/" + metaFilename,
    "url"         : assetIndex.url,
    "expectedHash": { "kind": "sha1", "sum": assetIndex.sha1 },
    "expectedSize": assetIndex.size,
    "validate"    : validAssets,
  });

  if (!("data" in index)) return false;
  try {
    const path = FileManager.join(directories.assetIndexes, metaFilename);
    const missing = await FileManager.verifyPaths({
      "paths": [{ path, "hash": assetIndex.sha1 }], "algorithm": "sha1",
    });

    if (missing.length > 0) await publish(directories.assetIndexes, metaFilename, index.bytes);
  } catch (error) {
    statuses.current = LaunchStatus.AssetIndex.FailedToGet;
    log.error(logPrefix, Errors.prettify(error));

    return false;
  }

  const mappedAssetObjects = Object.values(index.data.objects)
    .map(({ hash, size }) => {
      const shortHash = hash.slice(0, 2);
      const url = APIEndpoints.Resources.Base + shortHash + "/" + hash;
      const shortHashPath = FileManager.join(directories.assetObjects, shortHash);
      const filePath = FileManager.join(shortHashPath, hash);

      return {
        shortHashPath,
        size,
        hash,
        url,
        "path": filePath,
      };
    });

  const report = await downloadMissing({
    signal,
    statuses,
    cancelId,
    "entries"    : mappedAssetObjects,
    "checksum"   : instance.checksum,
    "concurrency": GeneralSettings.ConcurrentDownloads.Assets,
    "label"      : "assets",
  });

  if (report.failed > 0 || report.cancelled) {
    return false;
  }

  statuses.current = LaunchStatus.AssetObjects.Success;

  return true;
}
