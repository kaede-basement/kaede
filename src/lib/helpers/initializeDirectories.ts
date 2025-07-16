import { BaseDirectory } from "@tauri-apps/api/path";
import { mkdir } from "@tauri-apps/plugin-fs";
import * as constants from "~/constants/app";
import type { FunctionResponsesType } from "~/types/FunctionResponses.type";

export default async function initializeDirectories(): Promise<FunctionResponsesType> {
  try {
    const configDirectoryVariables = Object.keys(constants).
      filter(key => key.endsWith("_ConfigFolder"));
    const dataDirectoryVariables = Object.keys(constants).
      filter(key => key.endsWith("_DataFolder"));

    for (const directory in configDirectoryVariables) {
      await mkdir(directory, {
        "baseDir"   : BaseDirectory.AppConfig,
        "recursive" : true,
      });
    }
    for (const directory in dataDirectoryVariables) {
      await mkdir(directory, {
        "baseDir"   : BaseDirectory.AppLocalData,
        "recursive" : true,
      });
    }
  } catch (error: unknown) {
    console.error(error);

    return constants.FunctionResponses.Error;
  }

  return constants.FunctionResponses.Success;
}