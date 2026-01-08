import { LaunchStatus } from "@/constants/launcher.ts";
import type { PatchRequiresType } from "@/types/launcher/meta/patch-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import General from "@/lib/general";
import { FileStructure } from "@/constants/file-structure.ts";
import type { LaunchStatusType } from "@/types/launcher/launch/launch-status.type.ts";
import { fetchMetadata } from "@/lib/launcher/scopes/fetching/fetch-metadata.ts";

export async function resolvePatchVersion({
  necessaries,
  metadata,
}: {
  "necessaries": PreLaunchInformationType;
  "metadata"   : PatchRequiresType;
}): Promise<string> {
  // 'requires' entry usually has a specified version
  const specified: string | undefined = metadata.equals ?? metadata.suggests;

  if (specified !== undefined) {
    return specified;
  }

  const { directories, statuses } = necessaries;
  const fileName: string = metadata.uid + ".json";
  let parsedPatchMetadata: unknown;

  try {
    log.debug(`Reading the cached index manifest for '${metadata.uid}'`);
    statuses.current = LaunchStatus.Patches.ReadingLatestVersion;
    parsedPatchMetadata = await General.handleJsonFile({
      "baseDirectory"  : directories.base,
      "path"           : [FileStructure.Folders.Cache.Path, fileName],
      "label"          : `/cache/${fileName}`,
      "getDefaultValue": async () => {
        log.debug(`No cache; fetching the cached index manifest for '${metadata.uid}'`);
        statuses.current = LaunchStatus.Patches.FetchingLatestVersion;
        const fetched: object | LaunchStatusType = await fetchMetadata({
          "url"  : "",
          "label": "",
          "scope": "",
        })
      },
    });
  }
}
