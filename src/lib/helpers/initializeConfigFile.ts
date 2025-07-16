import { BaseDirectory } from "@tauri-apps/api/path";
import { exists, writeFile } from "@tauri-apps/plugin-fs";
import { InitialAppConfiguration } from "~/constants/configs";
import { ConfigFilename, FunctionResponses } from "~/constants/app";
import type { FunctionResponsesType } from "~/types/FunctionResponses.type";

export default async function initializeConfigFile(): Promise<FunctionResponsesType> {
  /*
   * checks if "{APP_CONFIGS_DIRECTORY}/kaede/config.json" exists
   * on Windows equals to C:\Users\{USER}\AppData\Roaming\kaede\config.json
   */
  const configExists: boolean = await exists(ConfigFilename, {
    "baseDir": BaseDirectory.AppConfig,
  });

  // if config exists, we should not overwrite it
  if (configExists) {
    return FunctionResponses.Exists;
  }

  // encoding config data to pass it to "writeFile()" function later
  const encoder: TextEncoder = new TextEncoder;
  const data: Uint8Array = encoder.encode(JSON.stringify(
    InitialAppConfiguration,
    // save formatting
    null,
    // with two spaces as an indent
    2,
  ));

  /*
   * we are wrapping this in "try & catch" construction
   * because "writeFile" can throw an error
   */
  try {
    await writeFile(ConfigFilename, data, { "baseDir": BaseDirectory.AppConfig });
  } catch (error: unknown) {
    console.error(error);

    return FunctionResponses.Error;
  }

  return FunctionResponses.Success;
}
