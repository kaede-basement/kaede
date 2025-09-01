import { log } from "@/lib/handlers/log.ts";
import { BaseDirectory, exists, readTextFile } from "@tauri-apps/plugin-fs";
import { ConfigFilename } from "@/constants/application.ts";
import { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import { initializeConfigFile } from "@/lib/main/initialize-config-file.ts";
import { type ConfigType, ConfigValidator } from "@/types/config/config.schema.ts";

export async function getConfigFile(): Promise<ConfigType> {
  log.debug("Checking if config file exists");
  const configExists = await exists(ConfigFilename, {
    "baseDir": BaseDirectory.AppData,
  });

  if (!configExists) {
    log.info("Config file doesn't exist");
    log.debug("Initializing a config file");
    await initializeConfigFile();

    log.debug("Returning a promise with default config");

    // Awaiting here will be just an unnecessary action
    return getDefaultConfig();
  }

  log.info("Config file exists");
  log.debug("Reading a config file");
  const configFile = await readTextFile(ConfigFilename, {
    "baseDir": BaseDirectory.AppData,
  });

  console.log(configFile);

  log.debug("Parsing config file");
  const parsedConfig: unknown = await JSON.parse(configFile);

  log.debug("Validating config file");
  const validatedConfig = ConfigValidator.Check(parsedConfig);

  if (!validatedConfig) {
    log.info("Config file is invalid");
    log.debug("Returning a promise with default config");

    // Awaiting here will be just an unnecessary action
    return getDefaultConfig();
  }

  log.info("Config file is valid");

  return parsedConfig;
}
