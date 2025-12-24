import { type DirEntry, mkdir, readDir } from "@tauri-apps/plugin-fs";

import General from "@/lib/general";

const shortHashes: Array<string> = Array
  .from(
    { "length": 256 },
    (_, index) => index.toString(16).padStart(2, "0"),
  );

export async function initializeShortHashDirectories({
  assetsFolders,
}: {
  "assetsFolders": {
    "indexes": string;
    "objects": string;
  };
}): Promise<void> {
  const objects: Array<DirEntry> = await readDir(assetsFolders.objects);
  const existingFolders: Set<string> = new Set(
    objects.map(({ name }) => name),
  );
  const missingPaths = shortHashes
    .filter(hash => !existingFolders.has(hash))
    .map(hash => General.cachedJoin(assetsFolders.objects, hash));

  console.log(missingPaths);

  await Promise.all(
    missingPaths.map(path => mkdir(path)),
  );
}
