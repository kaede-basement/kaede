import { FileStructure } from "@/constants/file-structure.ts";
import { APIEndpoints, LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { fetchAssetsMeta } from "@/lib/launcher/scopes/fetching/fetch-assets-meta.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type {
  LauncherStatusesType,
  LaunchStatusType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getPatch({
  baseDirectory,
  statuses,
  require,
}: {
  "baseDirectory": string;
  "statuses"     : LauncherStatusesType;
  "require"      : Required<
    Required<SpecificPatchMetaType>["requires"]
  >[number];
}): Promise<SpecificPatchMetaType | false> {
  const versionWithExtension: string = require.suggests + ".json";

  /*
   * The minecraft version metadata is stored as '${version}.json',
   * so make sure the patch metadata file format follows the same structure
   */
  const fileName: string = require.uid === "net.minecraft"
    ? versionWithExtension
    : require.uid + "-" + versionWithExtension;
  let parsedMeta: unknown;

  try {
    log.debug(__PRE_BUNDLED_FILENAME__, `Reading the cached metadata for '${require?.uid}'`);
    statuses.current = LaunchStatus.Metadata.ReadingCachedPatchMeta;
    parsedMeta = await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Folders.Cache.Path, fileName],
      "label"          : `/cache/${fileName}`,
      "getDefaultValue": async () => {
        log.warn(
          __PRE_BUNDLED_FILENAME__,
          `No cache; fetching the metadata for '${require?.uid}'`,
        );
        statuses.current = LaunchStatus.Metadata.FetchingPatchMeta;
        const fetched: object | LaunchStatusType = await fetchAssetsMeta({
          "url": APIEndpoints.Meta.Base + require.uid + "/" + versionWithExtension,
        });

        if (typeof fetched !== "object") {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            `Could not fetch the metadata for '${require?.uid}'. Status: ${fetched}`,
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

  log.debug(__PRE_BUNDLED_FILENAME__, `Validating the metadata for '${require?.uid}'`);
  const validMeta: SpecificPatchMetaType | false = Schemas.validate.patchMeta({
    "value": parsedMeta,
    "label": "specific patch metadata",
    "info" : {
      "id": require.uid,
    },
  });

  if (validMeta === false) {
    log.error(__PRE_BUNDLED_FILENAME__, `The metadata for '${require?.uid}' is invalid`);
    statuses.current = LaunchStatus.Errors.PatchFullValidationFailed;

    return false;
  }

  log.info(__PRE_BUNDLED_FILENAME__, `The '${validMeta.uid}' patch metadata is valid`);

  return validMeta;
}
