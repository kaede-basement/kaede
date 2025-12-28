import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { fetchVersionMeta } from "@/lib/launcher/scopes/fetch-version-meta.ts";
import Schemas from "@/lib/schemas";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function getVersionMeta(
  necessaries: PreLaunchInformationType,
): Promise<SpecificPatchMetaType | false> {
  const beforeHooksResult: "continue" | SpecificPatchMetaType | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<SpecificPatchMetaType | false>({
      "scope" : "onVersionMeta",
      "toPass": necessaries,
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, instance, statuses } = necessaries;

  const baseDirectory: string = directories.base;
  const version: string = instance.version;
  let parsed: unknown;

  try {
    statuses.current = LaunchStatus.Metadata.ReadingCachedVersionMeta;
    parsed = await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Folders.Cache.Path, `${version}.json`],
      "label"          : `/cache/${version}.json`,
      "getDefaultValue": async () => {
        statuses.current = LaunchStatus.Metadata.FetchingVersionMeta;
        const fetched: object | LaunchStatusType = await fetchVersionMeta({ version });

        if (typeof fetched === "string") {
          statuses.current = fetched;

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
    return false;
  }

  statuses.current = LaunchStatus.Metadata.ValidatingVersionMeta;
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
    statuses.current = LaunchStatus.Errors.MetaVersionFullValidationFailed;

    return false;
  }

  const afterHooksResult: "continue" | SpecificPatchMetaType | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<SpecificPatchMetaType | false>({
      "scope" : "onVersionMeta",
      "toPass": {
        necessaries,
        minecraftVersionMeta,
      },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  return minecraftVersionMeta;
}
