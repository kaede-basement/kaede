import { FileStructure } from "@/constants/file-structure.ts";
import { APIEndpoints, LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { fetchAssetsMeta } from "@/lib/launcher/scopes/version-meta/assets/fetch-assets-meta.ts";
import type {
  LauncherStatusesType,
  LaunchStatusType,
} from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getPatch({
  baseDirectory,
  statuses,
  require,
}: {
  "baseDirectory": string;
  "statuses"     : LauncherStatusesType;
  "require"      : MetaMinecraftVersionType["requires"][number];
}): Promise<object | false> {
  const versionWithExtension: string = require.suggests + ".json";
  const fileName: string = require.uid + "-" + versionWithExtension;
  let parsedMeta: unknown;

  try {
    statuses.add(LaunchStatus.Metadata.ReadingCachedPatchMeta);
    parsedMeta = await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Folders.Cache.Path, fileName],
      "label"          : `/cache/${fileName}`,
      "getDefaultValue": async () => {
        statuses.add(LaunchStatus.Metadata.FetchingPatchMeta);
        const fetched: object | LaunchStatusType = await fetchAssetsMeta({
          "url": APIEndpoints.Meta.Base + require.uid + "/" + versionWithExtension,
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

  if (typeof parsedMeta !== "object" || parsedMeta === null) {
    return false;
  }

  return parsedMeta;
}
