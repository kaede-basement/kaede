import type { BaseDirectory } from "@tauri-apps/api/path";
import type { FunctionResponsesType } from "~/types/FunctionResponses.type";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { FunctionResponses } from "~/constants/app";
import { join } from "@tauri-apps/api/path";

export default async function makeDirectory({
  baseDirectoryPath,
  recursiveDirectories,
}: {
  /** A base directory path with BaseDirectory type */
  baseDirectoryPath:    BaseDirectory;
  /** An array of folders that should be nested inside each other */
  recursiveDirectories: Array<string>;
}): Promise<FunctionResponsesType> {
  const directoryToMake = await join(...recursiveDirectories);

  // checks if "{baseDirectoryPath}/{directoryToMake}" exists
  const passedDirectoryExists: boolean = await exists(directoryToMake, {
    baseDir: baseDirectoryPath,
  });

  // if path exists, we should not overwrite it
  if (passedDirectoryExists) {
    return FunctionResponses.Exists;
  }

  // we are wrapping this in "try & catch" construction
  // because "mkdir" can throw an error
  try {
    // make a directory in {baseDirectoryPath}
    await mkdir(directoryToMake, {
      baseDir:   baseDirectoryPath,
      // run "mkdir" recursively only if we need to make nested folders
      recursive: recursiveDirectories.length > 1,
    });
  } catch (error: unknown) {
    console.error(error);

    return FunctionResponses.Error;
  }

  return FunctionResponses.Success;
}
