import { type DirEntry, readDir } from "@tauri-apps/plugin-fs";

export async function checkObjectDirectories({
  assetsFolders,
  shortHashes,
}: {
  "assetsFolders": {
    "indexes": string;
    "objects": string;
  };
  "shortHashes": Array<string>;
}): Promise<boolean> {
  const directoriesPresent: Array<DirEntry> = await readDir(assetsFolders.objects);
  const presentPaths: Set<string> = new Set;

  for (const { name } of directoriesPresent) {
    presentPaths.add(name);
  }

  for (const shortHash of shortHashes) {
    if (!presentPaths.has(shortHash)) {
      return false;
    }
  }

  return true;
}
