import { type DirEntry, exists, readDir } from "@tauri-apps/plugin-fs";

import General from "@/lib/general";

export async function validateAssets({
  assetsFolders,
  metaFilename,
}: {
  "assetsFolders": {
    "indexes": string;
    "objects": string;
  };
  "metaFilename": string;
}): Promise<boolean> {
  const [metaExists, storedObjects]: [boolean, Array<DirEntry>] = await Promise.all([
    exists(
      General.cachedJoin(
        assetsFolders.indexes,
        metaFilename,
      ),
    ),
    readDir(
      assetsFolders.objects,
    ),
  ]);

  console.log(metaExists, storedObjects);

  return metaExists && storedObjects.length > 0;
}
