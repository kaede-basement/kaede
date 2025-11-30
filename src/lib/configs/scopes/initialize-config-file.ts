import { writeTextFile } from "@tauri-apps/plugin-fs";

import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function initializeConfigFile(configFilePath: string): Promise<void> {
  log.debug("Getting default config");
  const defaultConfig = await getDefaultConfig();

  log.debug("Writing the default config file");
  await writeTextFile(configFilePath, JSON.stringify(
    defaultConfig,
    // Save formatting
    null,
    // With two spaces as an indent
    2,
  ));
}
