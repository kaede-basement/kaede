import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { fetchVersionMeta } from "@/lib/launcher/scopes/fetch-version-meta.ts";
import Schemas from "@/lib/schemas";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function getVersionMeta({
  statuses,
  instance,
  directories,
}: PreLaunchInformationType): Promise<SpecificPatchMetaType | undefined> {
  const baseDirectory: string = directories.base;
  const version: string = instance.version;
  let parsed: unknown;

  try {
    statuses.add(LaunchStatus.Metadata.ReadingCachedVersionMeta);
    parsed = await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Folders.Cache.Path, `${version}.json`],
      "label"          : `/cache/${version}.json`,
      "getDefaultValue": async () => {
        statuses.add(LaunchStatus.Metadata.FetchingVersionMeta);
        const fetched: object | LaunchStatusType = await fetchVersionMeta({ version });

        if (typeof fetched === "string") {
          statuses.add(fetched);

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

  statuses.add(LaunchStatus.Metadata.ValidatingVersionMeta);
  const unsafeParsed = (parsed as { "uid"?: string });
  const logId: string = unsafeParsed?.uid ?? "unknown";
  const minecraftVersionMeta: SpecificPatchMetaType | false = Schemas.validate.patchMeta({
    "value": parsed,
    "label": "minecraft version meta",
    "info" : {
      "id": logId,
    },
  });

  if (minecraftVersionMeta === false) {
    statuses.add(LaunchStatus.Errors.MetaVersionFullValidationFailed);

    return undefined;
  }

  return minecraftVersionMeta;
}
