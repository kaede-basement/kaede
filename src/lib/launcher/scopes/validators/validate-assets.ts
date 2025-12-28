import { exists } from "@tauri-apps/plugin-fs";

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
  return await exists(
    General.cachedJoin(
      assetsFolders.indexes,
      metaFilename,
    ),
  );
}
