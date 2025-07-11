import { BaseDirectory } from "@tauri-apps/api/path";
import { exists, writeFile, mkdir } from "@tauri-apps/plugin-fs";
import { InitialAppConfiguration } from "~/constants/configs";
import { FunctionResponses } from "~/constants/app";
import type { FunctionResponsesType } from "~/types/FunctionResponses.type";

export default async function initializeConfigFile(): Promise<FunctionResponsesType> {
  // checks if "{APP_CONFIGS_DIRECTORY}/kaede" exists
  // on Windows equals to C:\Users\{USER}\AppData\Roaming\kaede
  const configDirectoryExists: boolean = await exists("", {
    baseDir: BaseDirectory.AppConfig,
  });

  // make a directory "kaede" in {APP_CONFIGS_DIRECTORY} if it doesn't exist already
  if (!configDirectoryExists) {
    // we are wrapping this in "try & catch" construction
    // because "mkdir" can throw an error
    try {
      await mkdir("", {
        baseDir: BaseDirectory.AppConfig,
      });
    } catch (error) {
      console.error(error);

      return FunctionResponses.Error;
    }
  }

  // checks if "{APP_CONFIGS_DIRECTORY}/kaede/config.json" exists
  // on Windows equals to C:\Users\{USER}\AppData\Roaming\kaede\config.json
  const configExists: boolean = await exists("config.json", {
    baseDir: BaseDirectory.AppConfig,
  });

  // if config exists, we should not overwrite it
  if (configExists) {
    return FunctionResponses.Exists;
  }

  // encoding config data to pass it to "writeFile()" function later
  const encoder: TextEncoder = new TextEncoder();
  const data: Uint8Array = encoder.encode(
    JSON.stringify(
      InitialAppConfiguration,
      // save formatting
      null,
      // with two spaces as an indent
      2,
    ),
  );

  // we are wrapping this in "try & catch" construction
  // because "writeFile" can throw an error
  try {
    await writeFile(
      "config.json", data,
      { baseDir: BaseDirectory.AppConfig },
    );
  } catch (error: unknown) {
    console.error(error);

    return FunctionResponses.Error;
  }

  return FunctionResponses.Success;
}
