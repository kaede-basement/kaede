import { exists, mkdir } from "@tauri-apps/plugin-fs";

import {
  initializeShortHashDirectories,
} from "@/lib/launcher/scopes/version-meta/assets/initialize-short-hash-directories.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function initializeAssetsDirectories(
  necessaries: PreLaunchInformationType,
): Promise<void> {
  const { directories } = necessaries;

  log.debug("Checking if '/assets/indexes/' and '/assets/objects/' exist");
  const [indexesExists, objectsExists]: [boolean, boolean] = await Promise.all([
    exists(directories.assetIndexes),
    exists(directories.assetObjects),
  ]);

  if (!indexesExists && !objectsExists) {
    log.debug("Initializing the '/assets/indexes/' and '/assets/objects/' directories");
    await Promise.all([
      mkdir(directories.assetIndexes),
      mkdir(directories.assetObjects),
    ]);

    return initializeShortHashDirectories(necessaries);
  }

  if (!indexesExists) {
    log.debug("Initializing the '/assets/indexes/' directory");
    await mkdir(directories.assetIndexes);

    return initializeShortHashDirectories(necessaries);
  }

  if (!objectsExists) {
    log.debug("Initializing the '/assets/objects/' directory");
    await mkdir(directories.assetObjects);

    return initializeShortHashDirectories(necessaries);
  }

  log.info("The '/assets/indexes/' and '/assets/objects/' directories exist");

  return initializeShortHashDirectories(necessaries);
}
