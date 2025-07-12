import type { FunctionResponsesType } from "~/types/FunctionResponses.type";
import type { BaseDirectory } from "@tauri-apps/api/path";
import { FunctionResponses } from "~/constants/app";
import { join } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";

const makeDirectory = async ({
  baseDirectoryPath,
  recursiveDirectories,
}: {

  /** A base directory path with BaseDirectory type */
  baseDirectoryPath: BaseDirectory;

  /** An array of folders that should be nested inside each other */
  recursiveDirectories: Array<string>;
}): Promise<FunctionResponsesType> => {
  const directoryToMake = await join(...recursiveDirectories);

  // checks if "{baseDirectoryPath}/{directoryToMake}" exists
  const passedDirectoryExists: boolean = await exists(directoryToMake, {
    baseDir: baseDirectoryPath,
  });

  // if path exists, we should not overwrite it
  if (passedDirectoryExists) {
    return FunctionResponses.Exists;
  }

  /*
   * we are wrapping this in "try & catch" construction
   * because "mkdir" can throw an error
   */
  try {
    // make a directory in {baseDirectoryPath}
    await mkdir(directoryToMake, {
      baseDir  : baseDirectoryPath,
      // run "mkdir" recursively only if we need to make nested folders
      recursive: recursiveDirectories.length > 1,
    });
  } catch (error: unknown) {
    console.error(error);

    return FunctionResponses.Error;
  }

  return FunctionResponses.Success;
};

export default async function makeDirectories({
  directories,
}: {
  directories: Array<{

    /** A base directory path with BaseDirectory type */
    baseDirectoryPath: BaseDirectory;

    /** An array of folders that should be nested inside each other */
    recursiveDirectories: Array<string>;
  }>;
}): Promise<FunctionResponsesType> {
  // make a set that will store unique results from every directory write
  const results = new Set;

  // iterate through every "directories" array element
  for (const directory of directories) {
    // destructure properties from an array element
    const { recursiveDirectories, baseDirectoryPath } = directory;
    // pass destructured properties into the "makeDirectory" function
    const result = await makeDirectory({
      baseDirectoryPath   : baseDirectoryPath,
      recursiveDirectories: recursiveDirectories,
    });

    // add executed function response to the "results" array
    results.add(result);
  }

  // if something went wrong even with one directory creation, we should return error
  if (results.has(FunctionResponses.Error)) {
    return FunctionResponses.Error;
  }

  return FunctionResponses.Success;
}
