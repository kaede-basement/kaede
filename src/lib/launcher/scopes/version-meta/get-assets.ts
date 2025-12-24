import { download } from "@tauri-apps/plugin-upload";

import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { fetchAssetsMeta } from "@/lib/launcher/scopes/version-meta/assets/fetch-assets-meta.ts";
import {
  initializeAssetsDirectories,
} from "@/lib/launcher/scopes/version-meta/assets/initialize-assets-directories.ts";
import {
  shallowlyValidateMeta,
} from "@/lib/launcher/scopes/version-meta/assets/shallowly-validate-meta.ts";
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
        const fetched: AssetObjectsType | LaunchStatusType = await fetchAssetsMeta({
          "assetIndex": assetIndex.id,
          "url"       : assetIndex.url,
          "filePath"  : General.cachedJoin(assetsFolders.indexes, metaFilename),
        });

        if (typeof fetched === "string") {
          currentStatuses.value.add(fetched);

          /*
           * The 'General#handleJsonFile' function writes the returned value
           * into the file specified earlier, but in case of an error we do not
           * want to write anything. Therefore, we break out of that function
           */
          throw new Error("An error occurred while fetching the version meta");
        }

        return fetched;
      },
    });
  } catch {
    return undefined;
  }

  const shallowlyValid: AssetObjectsType | false = shallowlyValidateMeta({ "meta": parsedMeta });

  if (shallowlyValid === false) {
    currentStatuses.value.add(LaunchStatus.Errors.MetaAssetsShallowValidationFailed);

    return undefined;
  }

  console.log(shallowlyValid);

  /**
   * await download(
   *     assetIndex.url,
   *     assetsFilePath,
   *     ({ progressTotal, total }) => {
   *       console.log(Math.floor(progressTotal / total * 100));
   *     },
   *   );
   */
}
