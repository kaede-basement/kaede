import { type DirEntry, mkdir, readDir } from "@tauri-apps/plugin-fs";

import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

const shortHashes: Array<string> = Array
  .from(
    { "length": 256 },
    (_, index) => index.toString(16).padStart(2, "0"),
  );

export async function initializeShortHashDirectories({
  directories,
}: PreLaunchInformationType): Promise<void> {
  log.debug(__PRE_BUNDLED_FILENAME__, "Reading the '/assets/objects' directory");
  const objects: Array<DirEntry> = await readDir(directories.assetObjects);
  const existingFolders: Set<string> = new Set(
    objects.map(({ name }) => name),
  );
  const missingPaths = shortHashes
    .filter(hash => !existingFolders.has(hash))
    .map(hash => General.cachedJoin(directories.assetObjects, hash));

  if (missingPaths.length === 0) {
    return;
  }

  log.warn(
    __PRE_BUNDLED_FILENAME__,
    `Missing ${missingPaths.length} short hash directories; creating them`,
  );
  await Promise.all(
    missingPaths.map(path => mkdir(path)),
  );
}
