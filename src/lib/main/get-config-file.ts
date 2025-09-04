import { log } from "@/lib/handlers/log.ts";
import { ApplicationNamespace, ConfigFilename } from "@/constants/application.ts";
import { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import { initializeConfigFile } from "@/lib/main/initialize-config-file.ts";
import { type ConfigType, ConfigValidator } from "@/types/config/config.schema.ts";
const { BaseDirectory, exists, readTextFile } = window.__TAURI__.fs;

export async function getConfigFile(): Promise<ConfigType> {
  log.debug("Executing the 'before' method on extensions' hook for 'getConfigFile'");
  const hookResponse = await window[ApplicationNamespace].hooks.getConfigFile.before();

  if (hookResponse === "stop") {
    log.debug("'getConfigFile.before' hook has aborted execution");

    // Awaiting here will just be an unnecessary action
    return getDefaultConfig();
  }

  log.debug("Checking if config file exists");
  const configExists = await exists(ConfigFilename, {
    "baseDir": BaseDirectory.AppData,
  });

  if (!configExists) {
    log.info("Config file doesn't exist");
    log.debug("Initializing a config file");
    await initializeConfigFile();

    log.debug("Returning a promise with default config");

    // Awaiting here will just be an unnecessary action
    return getDefaultConfig();
  }

  log.info("Config file exists");
  log.debug("Reading a config file");
  const configFile = await readTextFile(ConfigFilename, {
    "baseDir": BaseDirectory.AppData,
  });

  log.debug("Parsing config file");
  const parsedConfig: unknown = await JSON.parse(configFile);

  log.debug("Validating config file");

  /*
   * If there is additional unknown properties in object, validation will pass it
   * which is actually good because extensions can use same config as the app
   */
  const validatedConfig = ConfigValidator.Check(parsedConfig);

  if (!validatedConfig) {
    log.info("Config file is invalid");
    log.debug("Returning a promise with default config");

    // Awaiting here will just be an unnecessary action
    return getDefaultConfig();
  }

  log.info("Config file is valid");

  return parsedConfig;
}
