import { FileStructure } from "@/constants/file-structure.ts";
import { APIEndpoints, ConcurrentDownloads, LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { fetchAssetsMeta } from "@/lib/launcher/scopes/fetching/fetch-assets-meta.ts";
import {
  shallowlyValidateMeta,
} from "@/lib/launcher/scopes/validators/shallowly-validate-meta.ts";
import { verifyArtifacts } from "@/lib/launcher/scopes/validators/verify-artifacts.ts";
import { log } from "@/lib/logging/scopes/log.ts";
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

  log.debug(__PRE_BUNDLED_FILENAME__, "Getting the assetIndex metadata");
  const { directories, statuses, instance } = necessaries;

  if (
    versionMeta?.assetIndex === undefined ||
    versionMeta?.assetIndex?.id === undefined ||
    versionMeta?.assetIndex?.url === undefined
  ) {
    log.error(__PRE_BUNDLED_FILENAME__, "The version meta is missing assetIndex metadata");
    statuses.current = LaunchStatus.Errors.MetaAssetsMissingMeta;

    return false;
  }

  const assetIndex: SpecificPatchAssetIndexType = versionMeta.assetIndex;
  const metaFilename = assetIndex.id + ".json";

  let parsedMeta: unknown;

  try {
    log.debug(__PRE_BUNDLED_FILENAME__, "Reading the cached assets metadata");
    statuses.current = LaunchStatus.Assets.ReadingCachedMeta;
    parsedMeta = await General.handleJsonFile({
      "baseDirectory"  : directories.base,
      "path"           : [FileStructure.Folders.Assets.Path, "indexes", metaFilename],
      "label"          : `/assets/indexes/${metaFilename}`,
      "getDefaultValue": async () => {
        log.warn(__PRE_BUNDLED_FILENAME__, "No cache; fetching the assets metadata");
        statuses.current = LaunchStatus.Assets.FetchingMeta;
        const fetched: object | LaunchStatusType = await fetchAssetsMeta({
          "url": assetIndex.url,
        });

        if (typeof fetched !== "object") {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            `Could not fetch the assets metadata. Status: ${fetched}`,
          );
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

  log.debug(__PRE_BUNDLED_FILENAME__, "Validating the assets metadata");
  const shallowlyValidMeta: AssetObjectsType | false = shallowlyValidateMeta({
    "meta": parsedMeta,
  });

  if (shallowlyValidMeta === false) {
    log.error(__PRE_BUNDLED_FILENAME__, "The assets metadata is invalid");
    statuses.current = LaunchStatus.Errors.MetaAssetsShallowValidationFailed;

    return false;
  }

  const mappedAssetObjects: Array<{
    "shortHashPath": string;
    "hash"         : string;
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
        hash,
        url,
        "path": filePath,
      };
    });

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Verifying ${mappedAssetObjects.length} assets for their existence.`,
    `SHA1 checks enabled: ${instance.checksum}`,
  );
  const startTime: number = performance.now();
  const hashesToReDownload: Set<string> = new Set(
    await verifyArtifacts({
      "paths"   : mappedAssetObjects,
      "checksum": instance.checksum,
    }),
  );
  const endTime: number = performance.now();
  const totalTime: string = (endTime - startTime).toFixed(2);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Successfully verified ${mappedAssetObjects.length} assets in ${totalTime} ms.`,
    `Total mismatches: ${hashesToReDownload.size}.`,
    `SHA1 checks enabled: ${instance.checksum}`,
  );

  const missingAssetObjects: Array<{
    "shortHashPath": string;
    "url"          : string;
    "path"         : string;
  }> = mappedAssetObjects.filter(({ path }) => {
    return hashesToReDownload.has(path);
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

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Successfully handled ${mappedAssetObjects.length} assets`,
    `and re-downloaded ${hashesToReDownload.size} of them`,
  );
  statuses.current = LaunchStatus.Assets.Done;

  return true;
}
