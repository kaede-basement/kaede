import { BaseDirectory } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { FunctionResponses, InstancesFolder } from "~/constants/app";
import type { FunctionResponsesType } from "~/types/FunctionResponses.type";

export default async function initializeInstancesFiles(): Promise<FunctionResponsesType> {
  /*
   * checks if "{APP_CONFIGS_DIRECTORY}/kaede/instances" exists
   * on Windows equals to C:\Users\{USER}\AppData\Roaming\kaede\instances
   */
  const instancesDirectoryExists: boolean = await exists(InstancesFolder, {
    baseDir: BaseDirectory.AppConfig,
  });

  // if path exists, we should not overwrite it
  if (instancesDirectoryExists) {
    return FunctionResponses.Exists;
  }

  /*
   * we are wrapping this in "try & catch" construction
   * because "mkdir" can throw an error
   */
  try {
    // make a directory "instances" in {APP_CONFIGS_DIRECTORY}/kaede
    await mkdir("instances", {
      baseDir: BaseDirectory.AppConfig,
    });
  } catch (error: unknown) {
    console.error(error);

    return FunctionResponses.Error;
  }

  return FunctionResponses.Success;
}
