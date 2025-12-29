import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { fetchVersionMeta } from "@/lib/launcher/scopes/fetching/fetch-version-meta.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { LaunchStatusType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

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
    log.debug("Reading the cached version metadata");
    statuses.current = LaunchStatus.Metadata.ReadingCachedVersionMeta;
    parsed = await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Folders.Cache.Path, `${version}.json`],
      "label"          : `/cache/${version}.json`,
      "getDefaultValue": async () => {
        log.warn("No cache; fetching the version metadata");
        statuses.current = LaunchStatus.Metadata.FetchingVersionMeta;
        const fetched: object | LaunchStatusType = await fetchVersionMeta({ version });

        if (typeof fetched === "string") {
          log.error("Could not fetch the version metadata. Status:", fetched);
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

  log.debug("Validating the version metadata");
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
    log.error("The version metadata is invalid");
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

  log.info("The version metadata is valid");

  return minecraftVersionMeta;
}
