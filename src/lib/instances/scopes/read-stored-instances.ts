import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export async function readStoredInstances(baseDirectory: string): Promise<InstanceStatesType> {
  const instancesMetadataPath = General.cachedJoin(baseDirectory, FileStructure.Files.Metadata);

  log.debug("Checking if instances metadata file exists");
  const metadataExists = await exists(instancesMetadataPath);

  if (!metadataExists) {
    log.warn("Instances metadata file does not exist");
    log.debug("Initializing an instances metadata file");
    await writeTextFile(instancesMetadataPath, "{}");

    return {};
  }

  const storedInstancesMetadata: string = await readTextFile(instancesMetadataPath);
  let parsed: unknown;

  try {
    parsed = JSON.parse(storedInstancesMetadata);
  } catch (error: unknown) {
    log.error("Could not parse the stored instances metadata:", Errors.prettify(error));

    return {};
  }

  log.debug("Validating the instances metadata");

  if (typeof parsed !== "object" || parsed === null) {
    log.debug("Instances metadata are completely invalid");

    return {};
  }

  const validInstances: InstanceStatesType = {};
  let allValid: boolean = true;

  for (const [currentId, currentMetadata] of Object.entries(parsed)) {
    const isValid: boolean = Schemas.InstanceMetadataValidator.Check(currentMetadata);

    if (!isValid) {
      log.warn(`The '${currentId}' instance is not valid`);
      allValid = false;

      continue;
    }

    log.debug(`The '${currentId}' instance is valid`);

    validInstances[currentId] = currentMetadata;
  }

  if (allValid) {
    log.info("All specified metadata instances are valid");
  }

  return validInstances;
}