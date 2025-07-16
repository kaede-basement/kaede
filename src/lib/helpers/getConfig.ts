import type { ConfigType } from "~/types/Config.type";
import { BaseDirectory, readTextFile } from "@tauri-apps/plugin-fs";
import { ConfigFilename } from "~/constants/app";
import { InitialAppConfiguration } from "~/constants/configs";
import { ConfigValidation } from "~/types/Config.type";
import { type } from "arktype";

export default async function getConfig(): Promise<ConfigType> {
  let configFileData: string;

  // config file might not exist, so we wrap it into try & catch construction
  try {
    configFileData = await readTextFile(ConfigFilename, {
      "baseDir": BaseDirectory.AppConfig,
    });
  } catch (error) {
    console.error(error);

    return InitialAppConfiguration;
  }

  /*
   * we don't know if there is actually a valid config file
   * so we assign "unknown" type to this variable
   */
  let parsedConfig: unknown;

  // JSON.parse can throw an error
  try {
    parsedConfig = JSON.parse(configFileData);
  } catch (error: unknown) {
    console.error(error);

    return InitialAppConfiguration;
  }

  // pass an unknown variable and get validated ConfigType or an error
  const validatedConfig = ConfigValidation(parsedConfig);

  // if "parsedConfig" is not valid, we get an error while validating
  if (validatedConfig instanceof type.errors) {
    console.error(validatedConfig.summary);

    return InitialAppConfiguration;
  }

  // at this point "validatedConfig" for sure has a "ConfigType" type
  return validatedConfig;
}
