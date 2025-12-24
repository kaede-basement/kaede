import { FileStructure } from "@/constants/file-structure.ts";
import { APIEndpoints, ConcurrentDownloads, LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import {
  checkObjectDirectories,
} from "@/lib/launcher/scopes/version-meta/assets/check-object-directories.ts";
import {
  downloadAssetObject,
} from "@/lib/launcher/scopes/version-meta/assets/download-asset-object.ts";
import { fetchAssetsMeta } from "@/lib/launcher/scopes/version-meta/assets/fetch-assets-meta.ts";
import {
  initializeAssetsDirectories,
} from "@/lib/launcher/scopes/version-meta/assets/initialize-assets-directories.ts";
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
  currentStatuses,
}: {
  "baseDirectory"  : string;
  "assetIndex"     : MetaMinecraftVersionType["assetIndex"];
  "currentStatuses": LauncherStatusesType;
}): Promise<string | undefined> {
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

  let parsedMeta: unknown;

  try {
    currentStatuses.value.add(LaunchStatus.Assets.ReadingCachedMeta);
    parsedMeta = await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Folders.Assets.Path, "indexes", metaFilename],
      "label"          : `/assets/indexes/${metaFilename}`,
      "getDefaultValue": async () => {
        currentStatuses.value.add(LaunchStatus.Assets.FetchingMeta);
        const fetched: object | LaunchStatusType = await fetchAssetsMeta({
          "url": assetIndex.url,
        });

        if (typeof fetched === "string") {
          currentStatuses.value.add(fetched);

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
  } catch (error) {
    console.error(error);

    return undefined;
  }

  const shallowlyValidMeta: AssetObjectsType | false = shallowlyValidateMeta({
    "meta": parsedMeta,
  });

  if (shallowlyValidMeta === false) {
    currentStatuses.value.add(LaunchStatus.Errors.MetaAssetsShallowValidationFailed);

    return undefined;
  }

  const assetEntryValues: Array<AssetObjectsType["objects"][string]> = Object.values(
    shallowlyValidMeta.objects,
  );
  // Short hashes to check against
  const shortHashes: Array<string> = [];
  // Assets to download
  const toDownload: Array<Array<{
    "shortHashPath": string;
    "url"          : string;
    "filePath"     : string;
  }>> = [];

  for (const [index, { hash }] of assetEntryValues.entries()) {
    const downloadGroupIndex = Math.floor(index / ConcurrentDownloads.Assets);

    if (!toDownload[downloadGroupIndex]) {
      toDownload[downloadGroupIndex] = [];
    }

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

    shortHashes.push(shortHash);
    toDownload[downloadGroupIndex].push({ shortHashPath, url, filePath });
  }

  console.log("uheee");
  const alreadyDownloaded: boolean = await checkObjectDirectories({
    assetsFolders,
    shortHashes,
  });

  if (alreadyDownloaded) {
    currentStatuses.value.add(LaunchStatus.Assets.Done);

    return;
  }

  console.log("uh");
  log.debug("Starting to download asset objects");
  for (const downloadGroup of toDownload) {
    console.log("Next group.");

    await Promise.all(
      downloadGroup.map(downloadInfo => downloadAssetObject(downloadInfo)),
    );
  }

  currentStatuses.value.add(LaunchStatus.Assets.Done);

  return assetsDirectory;
}
