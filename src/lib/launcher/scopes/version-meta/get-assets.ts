import { FileStructure } from "@/constants/file-structure.ts";
import { APIEndpoints, ConcurrentDownloads, LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { downloadWithProgress } from "@/lib/launcher/scopes/download-with-progress.ts";
import { fetchAssetsMeta } from "@/lib/launcher/scopes/version-meta/assets/fetch-assets-meta.ts";
import {
  initializeAssetsDirectories,
} from "@/lib/launcher/scopes/version-meta/assets/initialize-assets-directories.ts";
import {
  initializeShortHashDirectories,
} from "@/lib/launcher/scopes/version-meta/assets/initialize-short-hash-directories.ts";
import {
  shallowlyValidateMeta,
} from "@/lib/launcher/scopes/version-meta/assets/shallowly-validate-meta.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { AssetObjectsType } from "@/types/launcher/assets/asset-objects.type.ts";
import type {
  LauncherStatusesType,
  LaunchStatusType,
} from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export async function getAssets({
  baseDirectory,
  assetIndex,
  statuses,
}: {
  "baseDirectory": string;
  "assetIndex"   : MetaMinecraftVersionType["assetIndex"];
  "statuses"     : LauncherStatusesType;
}): Promise<string | false> {
  const metaFilename = assetIndex.id + ".json";
  const assetsDirectory = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Assets.Path,
  );
  const assetsFolders: {
    "indexes": string;
    "objects": string;
  } = {
    "indexes": General.cachedJoin(
      assetsDirectory,
      "indexes",
    ),
    "objects": General.cachedJoin(
      assetsDirectory,
      "objects",
    ),
  };

  await initializeAssetsDirectories({ assetsFolders });
  await initializeShortHashDirectories({ assetsFolders });

  let parsedMeta: unknown;

  try {
    statuses.add(LaunchStatus.Assets.ReadingCachedMeta);
    parsedMeta = await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Folders.Assets.Path, "indexes", metaFilename],
      "label"          : `/assets/indexes/${metaFilename}`,
      "getDefaultValue": async () => {
        statuses.add(LaunchStatus.Assets.FetchingMeta);
        const fetched: object | LaunchStatusType = await fetchAssetsMeta({
          "url": assetIndex.url,
        });

        if (typeof fetched !== "object") {
          statuses.add(fetched);

          /*
           * The 'General#handleJsonFile' function writes the returned value
           * into the file specified earlier, but in case of an error we do not
           * want to write anything. Therefore, we break out of that function
           */
          throw new Error("An error occurred while fetching the assets meta");
        }

        return fetched;
      },
    });
  } catch {
    return false;
  }

  const shallowlyValidMeta: AssetObjectsType | false = shallowlyValidateMeta({
    "meta": parsedMeta,
  });

  if (shallowlyValidMeta === false) {
    statuses.add(LaunchStatus.Errors.MetaAssetsShallowValidationFailed);

    return false;
  }

  const assetEntryValues: Array<AssetObjectsType["objects"][string]> = Object.values(
    shallowlyValidMeta.objects,
  );
  const mappedAssetObjects: Array<{
    "shortHashPath": string;
    "url"          : string;
    "filePath"     : string;
  }> = [];

  for (const { hash } of assetEntryValues.values()) {
    const shortHash = hash.slice(0, 2);
    const url = APIEndpoints.Resources.Base + shortHash + "/" + hash;
    const shortHashPath = General.cachedJoin(
      assetsFolders.objects,
      shortHash,
    );
    const filePath = General.cachedJoin(
      shortHashPath,
      hash,
    );

    mappedAssetObjects.push({
      shortHashPath,
      url,
      filePath,
    });
  }

  const missingHashes: Set<string> = new Set(
    await General.getMissingPaths({
      "paths": mappedAssetObjects.map(({ filePath }) => filePath),
    }),
  );

  const filteredAssetObjects = mappedAssetObjects.filter(({ filePath }) => {
    return missingHashes.has(filePath);
  });

  const assetObjectsToDownload: Array<Array<{
    "shortHashPath": string;
    "url"          : string;
    "filePath"     : string;
  }>> = [];

  for (const [index, value] of filteredAssetObjects.entries()) {
    const downloadGroupIndex = Math.floor(index / ConcurrentDownloads.Assets);

    if (!assetObjectsToDownload[downloadGroupIndex]) {
      assetObjectsToDownload[downloadGroupIndex] = [];
    }

    assetObjectsToDownload[downloadGroupIndex].push(value);
  }

  log.debug("Starting to download asset objects");
  for (const downloadGroup of assetObjectsToDownload) {
    await Promise.all(
      downloadGroup.map(({ url, filePath }) => downloadWithProgress({
        "statusScope": LaunchStatus.Assets.DownloadingAsset,
        url,
        filePath,
        statuses,
      })),
    );
  }

  statuses.add(LaunchStatus.Assets.Done);

  return assetsDirectory;
}
