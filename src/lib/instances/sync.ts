import { writeTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import { instanceStates } from "@/states/instance.ts";

let lastWritten: string | null | undefined;
let writing = Promise.resolve(true);

async function persist(): Promise<boolean> {
  if (lastWritten === undefined) {
    lastWritten = JSON.stringify(GlobalInternals.initialInstances, null, 2);
  }
  const contents = JSON.stringify(instanceStates, null, 2);

  if (lastWritten !== contents) {
    const path = FileManager.join(FileManager.getBaseDirectory(), FileStructure.Files.Metadata);

    await writeTextFile(path, contents);
    lastWritten = contents;
  }

  return true;
}

export function sync(): Promise<boolean> {
  writing = writing.then(persist).catch(error => {
    lastWritten = null;
    log.error(
      __PRE_BUNDLED_FILENAME__, "Failed to sync the instances metadata:", Errors.prettify(error),
    );

    return false;
  });

  return writing;
}
