import { exists, readTextFile, rename } from "@tauri-apps/plugin-fs";

import { ApplicationNamespace } from "@/constants/application.ts";
import { FileStructure } from "@/constants/file-structure.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function getConfigFile(passedBaseDirectory?: string): Promise<ConfigType> {
  const hooksArray = window[ApplicationNamespace].hooks.getConfigFile.before;
  let baseDirectory: string | undefined = passedBaseDirectory;

  if (!baseDirectory) {
    log.debug("No base directory was passed");
    log.debug("Checking if launcher is in portable version");
    const portable = await General.checkIsPortable();

    log.debug("Getting base directory");
    baseDirectory = await General.getBaseDirectory(portable);
  }

  const configFileDirectory = General.cachedJoin(baseDirectory, FileStructure.Config.Name);

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
    log.info("Config file does not exist");
    log.debug("Initializing a config file");
    await initializeConfigFile(configFileDirectory);

    log.debug("Returning a promise with default config");

    // Awaiting here will just be an unnecessary action
    return getDefaultConfig();
  }

  log.debug("Config file exists. Reading a config file");
  const configFile = await readTextFile(configFileDirectory);

  log.debug("Parsing a config file");
  let parsedConfig: unknown;

  try {
    parsedConfig = JSON.parse(configFile);
  } catch (error: unknown) {
    log.error("Couldn't parse the config file:", Errors.prettify(error));
    parsedConfig = {};
  }

  log.debug("Validating the config file");

  /*
   * If there is additional unknown properties in object, validation will pass them
   * which is actually good because extensions can use same config as the app
   */
  const validatedConfig = Schemas.ConfigValidator.Check(parsedConfig);

  if (!validatedConfig) {
    log.warn("Config file is invalid");
    log.debug("Renaming the invalid config file");
    const currentTimestamp: string = Date.now().toString();

    await rename(
      configFileDirectory,
      General.cachedJoin(
        baseDirectory,
        "config_invalid_" + currentTimestamp + ".json",
      ),
    );

    log.debug("Initializing a new config file with default values");
    await initializeConfigFile(configFileDirectory);

    log.debug("Returning a promise with default config");

    // Awaiting here will just be an unnecessary action
    return getDefaultConfig();
  }

  log.info("Config file is valid");

  // Assure TypeScript that the parsed config is valid
  return parsedConfig as ConfigType;
}
