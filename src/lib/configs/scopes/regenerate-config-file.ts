import { copyFile, readFile, writeFile } from "@tauri-apps/plugin-fs";

import Browser from "@/lib/browser";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function regenerateConfigFile({
  baseDirectory,
  configFileDirectory,
}: {
  "baseDirectory"      : string;
  "configFileDirectory": string;
}): Promise<ConfigType> {
  log.warn(__PRE_BUNDLED_FILENAME__, "Config file is invalid");
  log.debug(__PRE_BUNDLED_FILENAME__, "Backing up the invalid config file");
  const currentTimestamp: string = Date.now().toString();

  const backup = FileManager.join(baseDirectory, "config_invalid_" + currentTimestamp + ".json");

  if (Browser.detectIsBrowser()) {
    const bytes = await readFile(configFileDirectory);

    await writeFile(backup, bytes);
  } else {
    await copyFile(configFileDirectory, backup);
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing a new config file with default values");
  await initializeConfigFile(configFileDirectory);

  log.debug(__PRE_BUNDLED_FILENAME__, "Returning a promise with default config");

  // Awaiting here will just be an unnecessary action
  return getDefaultConfig();
}
