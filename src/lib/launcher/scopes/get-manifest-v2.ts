import { readTextFile, stat } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";

import { APIEndpoints, LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import { shallowValidateManifestV2 } from "@/lib/launcher/scopes/shallow-validate-manifest-v2.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { ManifestV2Type } from "@/types/launcher/manifest-v2.type.ts";

export async function getManifestV2({
  currentStatuses,
  cachedManifestV2Path,
}: {
  "currentStatuses"     : LauncherStatusesType;
  "cachedManifestV2Path": string;
}): Promise<{
  "updateCache": boolean;
  "manifest"   : ManifestV2Type | false;
}> {
  currentStatuses.value.add(LaunchStatus.ManifestV2.ReadingCache);

  let cachedManifestV2: ManifestV2Type | undefined;
  let isOutdatedCache: boolean = true;

  try {
    const [stored, stats] = await Promise.all([
      readTextFile(cachedManifestV2Path),
      stat(cachedManifestV2Path),
    ]);
    const lastModifiedCache: Date | null = stats.mtime;

    cachedManifestV2 = JSON.parse(stored);

    if (lastModifiedCache) {
      const currentDate = new Date;

      isOutdatedCache = General.checkDaysDifference(currentDate, lastModifiedCache) > 7;
    }
  } catch (error: unknown) {
    log.warn(
      "Could not get the cached 'manifest_v2.json' file. Error:",
      Errors.prettify(error),
    );
    cachedManifestV2 = undefined;
  }

  if (!isOutdatedCache && cachedManifestV2 !== undefined) {
    currentStatuses.value.add(LaunchStatus.ManifestV2.Validating);

    const validated = shallowValidateManifestV2(cachedManifestV2);

    return {
      // Prefer a shallow validation of manifests
      "manifest"   : validated,
      "updateCache": false,
    };
  }

  currentStatuses.value.add(LaunchStatus.ManifestV2.FetchingResponse);
  const response = await fetch(APIEndpoints.ManifestV2);

  currentStatuses.value.add(LaunchStatus.ManifestV2.ReadingResponse);
  const manifest: unknown = await response.json();

  currentStatuses.value.add(LaunchStatus.ManifestV2.Validating);
  const validated = shallowValidateManifestV2(manifest);

  return {
    // Prefer a shallow validation of manifests
    "manifest"   : validated,
    "updateCache": true,
  };
}