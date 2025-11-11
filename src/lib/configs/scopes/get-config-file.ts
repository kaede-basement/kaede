import { join } from "@tauri-apps/api/path";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";

import { ApplicationNamespace } from "@/constants/application.ts";
import { FileStructure } from "@/constants/file-structure.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { ConfigType } from "@/types/application/config.type.ts";

export async function getConfigFile(portableStatus?: boolean): Promise<ConfigType> {
  const hooksArray = window[ApplicationNamespace].hooks.getConfigFile.before;

  log.debug("Checking if launcher is in portable version");
  const portable = portableStatus ?? await General.checkIsPortable();

  log.debug("Getting base directory");
  const baseDirectory = await General.getBaseDirectory(portable);
  const configFileDirectory = await join(baseDirectory, FileStructure.Config.Name);

  log.debug(log.templates.hooks.iterate.start(
    "getConfigFile",
    "before",
    hooksArray.length,
  ));
  for (const [hookIndex, hookFunction] of hooksArray.entries()) {
    const timeMeasurementStartHook = performance.now();

    log.debug(log.templates.hooks.iterate.execution(
      "getConfigFile",
      "before",
      hookIndex,
      "async",
    ));
    const hookResponse = await hookFunction(configFileDirectory);
    const timeMeasurementEndHook = performance.now();
    const currentBeforeHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

    if (hookResponse.status === "stop") {
      log.debug(log.templates.hooks.iterate.response(
        "getConfigFile",
        hookResponse,
        "before",
        hookIndex,
        currentBeforeHookTime,
      ));

      // Awaiting here will just be an unnecessary action
      return hookResponse.response;
    }
  }

  log.debug("Checking if config file exists");
  const configExists = await exists(configFileDirectory);

  if (!configExists) {
    log.info("Config file doesn't exist");
    log.debug("Initializing a config file");
    await initializeConfigFile(configFileDirectory);

    log.debug("Returning a promise with default config");

    // Awaiting here will just be an unnecessary action
    return getDefaultConfig();
  }

  log.info("Config file exists");
  log.debug("Reading a config file");
  const configFile = await readTextFile(configFileDirectory);

  log.debug("Parsing a config file");
  const parsedConfig: unknown = JSON.parse(configFile);

  log.debug("Validating the config file");

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
