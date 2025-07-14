import { BaseDirectory } from "@tauri-apps/api/path";
import { mkdir } from "@tauri-apps/plugin-fs";
import * as constants from "~/constants/app";
import type { FunctionResponsesType } from "~/types/FunctionResponses.type";

export default async function initializeDirectories(): Promise<FunctionResponsesType> {
  try {
    const directoryVariables = Object.keys(constants).
      filter(key => key.endsWith("Folder"));

    for (const directory in directoryVariables) {
      await mkdir(directory, {
        baseDir  : BaseDirectory.AppConfig,
        recursive: true,
      });
    }
  } catch (error: unknown) {
    console.error(error);

    return constants.FunctionResponses.Error;
  }

  return constants.FunctionResponses.Success;
}