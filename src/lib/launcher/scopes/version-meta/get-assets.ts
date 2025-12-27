import { FileStructure } from "@/constants/file-structure.ts";
import { APIEndpoints, ConcurrentDownloads, LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
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
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";
import type {
  SpecificPatchAssetIndexType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function getAssets({
  necessaries,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<boolean> {
  const beforeHooksResult: "continue" | boolean | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftAssetsGet",
      "toPass": { necessaries, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses } = necessaries;

  if (
    versionMeta?.assetIndex === undefined ||
    versionMeta?.assetIndex?.id === undefined ||
    versionMeta?.assetIndex?.url === undefined
  ) {
    statuses.add(LaunchStatus.Errors.MetaAssetsMissingMeta);

    return false;
  }

  const assetIndex: SpecificPatchAssetIndexType = versionMeta.assetIndex;
  const metaFilename = assetIndex.id + ".json";
  const assetsFolders: {
    "indexes": string;
    "objects": string;
  } = {
    "indexes": General.cachedJoin(
      directories.assets,
      "indexes",
    ),
    "objects": General.cachedJoin(
      directories.assets,
      "objects",
    ),
  };

  await initializeAssetsDirectories({ assetsFolders });
  await initializeShortHashDirectories({ assetsFolders });

  let parsedMeta: unknown;

  try {
    statuses.add(LaunchStatus.Assets.ReadingCachedMeta);
    parsedMeta = await General.handleJsonFile({
      "baseDirectory"  : directories.base,
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

  const mappedAssetObjects: Array<{
    "shortHashPath": string;
    "url"          : string;
    "filePath"     : string;
  }> = Object
    .values(shallowlyValidMeta.objects)
    .map(({ hash }) => {
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

      return {
        shortHashPath,
        url,
        filePath,
      };
    });

  const missingHashes: Set<string> = new Set(
    await General.getMissingPaths({
      "paths": mappedAssetObjects.map(({ filePath }) => filePath),
    }),
  );

  const missingAssetObjects: Array<{
    "shortHashPath": string;
    "url"          : string;
    "filePath"     : string;
  }> = mappedAssetObjects.filter(({ filePath }) => {
    return missingHashes.has(filePath);
  });
  const indexReference: { "value": number } = {
    "value": 0,
  };

  log.debug("Starting to download asset objects");
  await Promise.all(
    Array
      .from({ "length": ConcurrentDownloads.Assets })
      .map(async (_, groupIndex) => {
        while (true) {
          if (indexReference.value >= missingAssetObjects.length) {
            break;
          }

          const entryOutOfTotal = `${indexReference.value + 1}/${missingAssetObjects.length}`;
          const index = indexReference.value++;
          const { url, filePath } = missingAssetObjects[index];

          log.debug(
            `Concurrency group ${groupIndex}: downloading (${entryOutOfTotal}) '${url}'`,
          );
          await downloadWithProgress({
            "statusScope": LaunchStatus.Assets.DownloadingAsset,
            url,
            filePath,
            statuses,
          });
        }
      }),
  );

  const afterHooksResult: "continue" | boolean | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftAssetsGet",
      "toPass": { necessaries, versionMeta },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  statuses.add(LaunchStatus.Assets.Done);

  return true;
}
