import type { ConfigType } from "~/types/Config.type";
import { BaseDirectory, readTextFile } from "@tauri-apps/plugin-fs";
import { ConfigFilename } from "~/constants/app";
import { InitialAppConfiguration } from "~/constants/configs";

export default async function getConfig(): Promise<ConfigType> {
  // by this point config file should already exist because
  // we executed initialization functions before we got here
  // so we can read config file's text content now
  const configFileData: string = await readTextFile(ConfigFilename, {
    baseDir: BaseDirectory.AppConfig,
  });

  // we don't know if there is actually a valid config file
  // so we assign "unknown" type to this variable
  let parsedConfig: unknown;

  // JSON.parse can throw an error
  try {
    parsedConfig = JSON.parse(configFileData);
  } catch (error: unknown) {
    console.error(error);

    return InitialAppConfiguration;
  }

  // because "parsedConfig" can be literally anything that JSON can parse,
  // we manually narrow variable type to object
  // null also counts as object, so we additionally check if "parsedConfig" is null
  if (typeof parsedConfig !== "object" || parsedConfig == null) {
    return InitialAppConfiguration;
  }

  return {
    ...InitialAppConfiguration,
    ...parsedConfig,
  };
}
