import { writeTextFile } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export async function saveInstanceStatesToFile(instances: InstanceStatesType): Promise<void> {
  log.debug("Starting the instance metadata sync");
  const timeStart = performance.now();
  const metadataPath = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Files.Metadata,
  );

  await writeTextFile(metadataPath, JSON.stringify(
    instances,
    null,
    2,
  ));

  const timeEnd = performance.now();
  const timeDifference = (timeEnd - timeStart).toFixed(1);

  log.info(
    "Instance metadata file successfully synced in:",
    timeDifference,
    "ms",
  );
}