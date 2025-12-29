import { FileStructure } from "@/constants/file-structure.ts";
import { APIEndpoints, ConcurrentDownloads, LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { fetchAssetsMeta } from "@/lib/launcher/scopes/fetching/fetch-assets-meta.ts";
import {
  shallowlyValidateMeta,
} from "@/lib/launcher/scopes/validators/shallowly-validate-meta.ts";
import type { AssetObjectsType } from "@/types/launcher/artifacts/asset-objects.type.ts";
import type { LaunchStatusType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchAssetIndexType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

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
    statuses.current = LaunchStatus.Errors.MetaAssetsMissingMeta;

    return false;
  }

  const assetIndex: SpecificPatchAssetIndexType = versionMeta.assetIndex;
  const metaFilename = assetIndex.id + ".json";

  let parsedMeta: unknown;

  try {
    statuses.current = LaunchStatus.Assets.ReadingCachedMeta;
    parsedMeta = await General.handleJsonFile({
      "baseDirectory"  : directories.base,
      "path"           : [FileStructure.Folders.Assets.Path, "indexes", metaFilename],
      "label"          : `/assets/indexes/${metaFilename}`,
      "getDefaultValue": async () => {
        statuses.current = LaunchStatus.Assets.FetchingMeta;
        const fetched: object | LaunchStatusType = await fetchAssetsMeta({
          "url": assetIndex.url,
        });

        if (typeof fetched !== "object") {
          statuses.current = fetched;

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
    statuses.current = LaunchStatus.Errors.MetaAssetsShallowValidationFailed;

    return false;
  }

  const mappedAssetObjects: Array<{
    "shortHashPath": string;
    "url"          : string;
    "path"         : string;
  }> = Object
    .values(shallowlyValidMeta.objects)
    .map(({ hash }) => {
      const shortHash = hash.slice(0, 2);
      const url = APIEndpoints.Resources.Base + shortHash + "/" + hash;
      const shortHashPath = General.cachedJoin(
        directories.assetObjects,
        shortHash,
      );
      const filePath = General.cachedJoin(
        shortHashPath,
        hash,
      );

      return {
        shortHashPath,
        url,
        "path": filePath,
      };
    });

  const missingHashes: Set<string> = new Set(
    await General.getMissingPaths({
      "paths": mappedAssetObjects.map(({ path }) => path),
    }),
  );

  const missingAssetObjects: Array<{
    "shortHashPath": string;
    "url"          : string;
    "path"         : string;
  }> = mappedAssetObjects.filter(({ path }) => {
    return missingHashes.has(path);
  });

  await General.concurrentlyDownload({
    statuses,
    "concurrency": ConcurrentDownloads.Assets,
    "entries"    : missingAssetObjects,
    "statusScope": LaunchStatus.Assets.DownloadingAsset,
  });

  const afterHooksResult: "continue" | boolean | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftAssetsGet",
      "toPass": { necessaries, versionMeta },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  statuses.current = LaunchStatus.Assets.Done;

  return true;
}
