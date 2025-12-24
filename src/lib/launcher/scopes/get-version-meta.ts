import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { fetchVersionMeta } from "@/lib/launcher/scopes/fetch-version-meta.ts";
import Schemas from "@/lib/schemas";
import type {
  LauncherStatusesType,
  LaunchStatusType,
} from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta-manifest.type.ts";

export async function getVersionMeta({
  currentStatuses,
  baseDirectory,
  version,
}: {
  "currentStatuses": LauncherStatusesType;
  "baseDirectory"  : string;
  "version"        : MetaMinecraftVersionType["version"];
}): Promise<MetaMinecraftVersionType | undefined> {
  let parsed: unknown;

  try {
    currentStatuses.value.add(LaunchStatus.Metadata.ReadingCachedVersionMeta);
    parsed = await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Folders.Cache.Path, `${version}.json`],
      "label"          : `${version}.json`,
      "getDefaultValue": async () => {
        currentStatuses.value.add(LaunchStatus.Metadata.FetchingVersionMeta);
        const fetched: object | LaunchStatusType = await fetchVersionMeta({ version });

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

  currentStatuses.value.add(LaunchStatus.Metadata.ValidatingVersionMeta);
  const valid: boolean = Schemas.MinecraftVersionValidator.Check(parsed);

  if (!valid) {
    currentStatuses.value.add(LaunchStatus.Errors.MetaVersionFullValidationFailed);

    return undefined;
  }

  return parsed as MetaMinecraftVersionType;
}
