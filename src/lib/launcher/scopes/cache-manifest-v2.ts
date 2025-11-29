import { writeTextFile } from "@tauri-apps/plugin-fs";

import { log } from "@/lib/logging/scopes/log.ts";
import type { ManifestV2Type } from "@/types/launcher/manifest-v2.type.ts";

export async function cacheManifestV2({
  updateCache,
  manifest,
  cachedManifestV2Path,
}: {
  "updateCache"         : boolean;
  "manifest"            : ManifestV2Type;
  "cachedManifestV2Path": string;
}): Promise<void> {
  if (!updateCache) {
    log.debug("No need for manifest_v2 cache update");

    return;
  }

  log.debug("Updating the cache for manifest_v2");
  await writeTextFile(cachedManifestV2Path, JSON.stringify(manifest));
}