import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export async function readStoredInstances(baseDirectory: string): Promise<InstanceStatesType> {
  const parsedMetadata: unknown = await General.handleJsonFile({
    baseDirectory,
    "path"        : [FileStructure.Files.Metadata],
    "label"       : "instances metadata",
    "defaultValue": {},
  });

  log.debug("Validating the instances metadata");

  if (typeof parsedMetadata !== "object" || parsedMetadata === null) {
    log.debug("Instances metadata are completely invalid");

    return {};
  }

  const validInstances: InstanceStatesType = {};
  let allValid: boolean = true;

  for (const [currentId, currentMetadata] of Object.entries(parsedMetadata)) {
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