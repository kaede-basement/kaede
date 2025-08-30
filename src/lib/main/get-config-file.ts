import { log } from "@/lib/handlers/log.ts";
import { BaseDirectory, exists, readTextFile } from "@tauri-apps/plugin-fs";
import { ConfigFilename } from "@/constants/application.ts";
import { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import { initializeConfigFile } from "@/lib/main/initialize-config-file.ts";

export async function getConfigFile(): Promise<object> {
  log.debug("Checking if config file exists");
  const configExists = await exists(ConfigFilename, {
    "baseDir": BaseDirectory.AppData,
  });

  if (!configExists) {
    log.info("Config file doesn't exist");
    log.debug("Initializing a config file");
    await initializeConfigFile();

    return getDefaultConfig();
  }

  log.info("Config file exists");
  const configFile = await readTextFile(ConfigFilename, {
    "baseDir": BaseDirectory.AppData,
  });
  const parsedConfig: unknown = await JSON.parse(configFile);
  const validatedConfig: object = (() => ({}))();

  if (!validatedConfig) {
    return getDefaultConfig();
  }

  return validatedConfig;
}
