import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";

export async function initializeDirectory(): Promise<void> {
  const baseDirectory = General.getCachedBaseDirectory();
  const path = General.cachedJoin(baseDirectory, FileStructure.Folders.Extensions.Path);

  const directoryExists = await exists(path);

  if (!directoryExists) {
    log.debug("Extensions directory does not exist. Creating it");

    return await mkdir(path);
  }

  log.debug("Extensions directory already exists");
}