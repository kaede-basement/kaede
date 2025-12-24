import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { log } from "@/lib/logging/scopes/log.ts";

export async function initializeAssetsDirectories({
  assetsFolders,
}: {
  "assetsFolders": {
    "indexes": string;
    "objects": string;
  };
}): Promise<void> {
  log.debug("Checking if '/assets/indexes/' and '/assets/objects/' exist");
  const [indexesExists, objectsExists]: [boolean, boolean] = await Promise.all([
    exists(assetsFolders.indexes),
    exists(assetsFolders.objects),
  ]);

  if (!indexesExists && !objectsExists) {
    log.debug("Initializing the '/assets/indexes/' and '/assets/objects/' directories");
    await Promise.all([
      mkdir(assetsFolders.indexes),
      mkdir(assetsFolders.objects),
    ]);

    return;
  }

  if (!indexesExists) {
    log.debug("Initializing the '/assets/indexes/' directory");
    await mkdir(assetsFolders.indexes);

    return;
  }

  if (!objectsExists) {
    log.debug("Initializing the '/assets/objects/' directory");
    await mkdir(assetsFolders.objects);

    return;
  }

  log.info("The '/assets/indexes/' and '/assets/objects/' directories exist");
}
