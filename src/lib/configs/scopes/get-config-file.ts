import { BaseDirectory, exists, readTextFile } from "@tauri-apps/plugin-fs";

import { ApplicationNamespace } from "@/constants/application.ts";
import { FileStructure } from "@/constants/file-structure.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { ConfigType } from "@/types/application/config.type.ts";

export async function getConfigFile(): Promise<ConfigType> {
  const hooksArray = window[ApplicationNamespace].hooks.getConfigFile.before;

  log.debug("Starting iterating through hooks for 'getConfigFile.before'");
  for (const [hookIndex, hookFunction] of hooksArray.entries()) {
    log.debug("Executing a hook with the next index:", hookIndex.toString());
    const hookResponse = await hookFunction();

    if (hookResponse.status === "stop") {
      log.debug(`A hook with the index of ${hookIndex} has aborted execution`);

      // Awaiting here will just be an unnecessary action
      return hookResponse.response;
    }
  }

  log.debug("Checking if config file exists");
  const configExists = await exists(FileStructure.Config.Name, {
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
  const configFile = await readTextFile(FileStructure.Config.Name, {
    "baseDir": BaseDirectory.AppData,
  });

  log.debug("Parsing config file");
  const parsedConfig: unknown = await JSON.parse(configFile);

  log.debug("Validating config file");

  /*
   * If there is additional unknown properties in object, validation will pass them
   * which is actually good because extensions can use same config as the app
   */
  const validatedConfig = Schemas.ConfigValidator.Check(parsedConfig);

  if (!validatedConfig) {
    log.warn("Config file is invalid");
    log.debug("Returning a promise with default config");

    // Awaiting here will just be an unnecessary action
    return getDefaultConfig();
  }

  log.info("Config file is valid");

  return parsedConfig;
}
