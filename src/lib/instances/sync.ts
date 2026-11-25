import { writeTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import { instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";

let lastWritten: string | null | undefined;
let writing = Promise.resolve(true);

type Addition = { "id": string; "instance": InstanceStateType };

function writeMetadata(addition?: Addition): Promise<boolean> {
  writing = writing.then(async () => {
    if (lastWritten === undefined) {
      lastWritten = JSON.stringify(GlobalInternals.initialInstances, null, 2);
    }
    const next = addition
      ? { ...instanceStates, [addition.id]: addition.instance }
      : instanceStates;
    const contents = JSON.stringify(next, null, 2);

    if (lastWritten !== contents) {
      const path = FileManager.join(FileManager.getBaseDirectory(), FileStructure.Files.Metadata);

      await writeTextFile(path, contents);
      lastWritten = contents;
    }
    if (addition) {
      instanceStates[addition.id] = addition.instance;
    }

    return true;
  }).catch(error => {
    lastWritten = null;
    log.error(
      __PRE_BUNDLED_FILENAME__, "Failed to sync the instances metadata:", Errors.prettify(error),
    );

    return false;
  });

  return writing;
}

export function registerInstance(id: string, instance: InstanceStateType): Promise<boolean> {
  return writeMetadata({ id, instance });
}

export function sync(): Promise<boolean> {
  return writeMetadata();
}
