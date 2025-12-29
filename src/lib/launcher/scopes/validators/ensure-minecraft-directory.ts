import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function ensureMinecraftDirectory(
  necessaries: PreLaunchInformationType,
): Promise<void> {
  log.debug("Checking if the minecraft directory exists");
  const directoryExists: boolean = await exists(necessaries.directories.instance);

  if (!directoryExists) {
    log.warn("The minecraft directory does not exist; creating it");
    await mkdir(necessaries.directories.instance, {
      "recursive": true,
    });
  }
}
