import { readTextFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";

import { APIEndpoints, LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import { shallowValidateManifestV2 } from "@/lib/launcher/scopes/shallow-validate-manifest-v2.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";
import type { ManifestV2Type } from "@/types/launcher/manifest-v2.type.ts";

export async function getManifestV2({
  changeStatus,
  cachedManifestV2Path,
}: {
  "changeStatus"        : (newStatus: LaunchStatusType) => void;
  "cachedManifestV2Path": string;
}): Promise<{
  "cached"  : boolean;
  "manifest": ManifestV2Type | false;
}> {
  changeStatus(LaunchStatus.ManifestV2.ReadingCache);
  let cachedManifestV2: ManifestV2Type | undefined;

  try {
    cachedManifestV2 = JSON.parse(
      await readTextFile(cachedManifestV2Path),
    );
  } catch (error: unknown) {
    log.warn(
      "Could not get the cached 'manifest_v2.json' file. Error:",
      Errors.prettify(error),
    );
    cachedManifestV2 = undefined;
  }

  if (cachedManifestV2 !== undefined) {
    return {
      // Prefer a shallow validation of manifests
      "manifest": shallowValidateManifestV2(cachedManifestV2),
      "cached"  : true,
    };
  }

  changeStatus(LaunchStatus.ManifestV2.FetchingResponse);
  const response = await fetch(APIEndpoints.ManifestV2);

  changeStatus(LaunchStatus.ManifestV2.ReadingResponse);
  const manifest: unknown = await response.json();

  return {
    // Prefer a shallow validation of manifests
    "manifest": shallowValidateManifestV2(manifest),
    "cached"  : false,
  };
}