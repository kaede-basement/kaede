import { type DirEntry, readDir, readTextFile } from "@tauri-apps/plugin-fs";

import Errors from "@/lib/errors";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";

async function transformToPromise(path: string, filename: string): Promise<ExtensionInfoType> {
  const filePath = General.cachedJoin(path, filename);
  const fileCode = await readTextFile(filePath);

  return {
    "id"  : filename.slice(0, -3),
    "code": fileCode,
  };
}

export async function readAllExtensions(): Promise<Array<ExtensionInfoType>> {
  const startTime = performance.now();
  const path = GlobalStateHelpers.get().fileSystem?.folders?.extensions;

  if (!path) {
    log.error("The extensions folder path in global states is undefined");

    return [];
  }

  log.debug("Reading the extensions folder");
  let storedFiles: Array<DirEntry>;

  try {
    storedFiles = await readDir(path);
  } catch (error: unknown) {
    log.error("Could not read the extensions folder:", Errors.prettify(error));

    return [];
  }

  const extensionFiles: Array<string> = [];

  for (const file of storedFiles) {
    if (file.isFile && file.name.endsWith(".js")) {
      extensionFiles.push(file.name);
    }
  }

  log.debug("Total extension files count:", extensionFiles.length.toString());
  log.debug("Fetching the contents of all stored extensions");
  const extensionCodes: Array<ExtensionInfoType> = await Promise.all(
    extensionFiles.map((filename: string) => {
      // 'Promise#all' expects pending promises, so do not await for Tauri invokes
      return transformToPromise(path, filename);
    }),
  );
  const endTime = performance.now();
  const timeDifference: string = (endTime - startTime).toFixed(2);

  log.info("Finished reading all extensions in:", timeDifference, "ms");

  return extensionCodes;
}