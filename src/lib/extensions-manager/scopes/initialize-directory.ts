import { exists, mkdir } from "@tauri-apps/plugin-fs";

import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";

export async function initializeDirectory(): Promise<void> {
  const path = GlobalStateHelpers.get().fileSystem?.folders?.extensions;

  if (!path) {
    return log.error("The extensions folder path in global states is undefined");
  }

  const directoryExists = await exists(path);

  if (!directoryExists) {
    log.debug("Extensions directory does not exist. Creating it");

    return await mkdir(path);
  }

  log.debug("Extensions directory already exists");
}