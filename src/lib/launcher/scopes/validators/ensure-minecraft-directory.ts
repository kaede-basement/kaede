import { exists, mkdir } from "@tauri-apps/plugin-fs";

import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function ensureMinecraftDirectory(
  necessaries: PreLaunchInformationType,
): Promise<void> {
  const directoryExists: boolean = await exists(necessaries.directories.instance);

  if (!directoryExists) {
    await mkdir(necessaries.directories.instance, {
      "recursive": true,
    });
  }
}