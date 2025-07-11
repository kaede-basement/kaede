import type { FunctionResponsesType } from "~/types/FunctionResponses.type";
import { FunctionResponses } from "~/constants/app";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/api/path";

export default async function makeConfigsDirectory(): Promise<FunctionResponsesType> {
  // checks if "{APP_CONFIGS_DIRECTORY}/kaede" exists
  // on Windows equals to C:\Users\{USER}\AppData\Roaming\kaede
  const configDirectoryExists: boolean = await exists("", {
    baseDir: BaseDirectory.AppConfig,
  });

  // if path exists, we should not overwrite it
  if (configDirectoryExists) {
    return FunctionResponses.Exists;
  }

  // we are wrapping this in "try & catch" construction
  // because "mkdir" can throw an error
  try {
    // make a directory "kaede" in {APP_CONFIGS_DIRECTORY}
    await mkdir("", {
      baseDir: BaseDirectory.AppConfig,
    });
  } catch (error: unknown) {
    console.error(error);

    return FunctionResponses.Error;
  }

  return FunctionResponses.Success;
}
