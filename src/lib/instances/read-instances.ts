import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { readState } from "@/lib/file-manager/read-state.ts";
import { log } from "@/lib/logging/log.ts";
import Schemas from "@/lib/schemas";
import type {
  InstanceStatesType,
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";
import type { ParsedFile } from "@/types/application/parsed-file.type.ts";

export async function readInstances(properties?: Partial<{
  "baseDirectory": string;
  "parsedFile"   : ParsedFile;
}>): Promise<InstanceStatesType> {
  const baseDirectory = properties?.baseDirectory ?? FileManager.getBaseDirectory();

  const filename = FileStructure.Files.Metadata;

  return readState(baseDirectory, filename, properties?.parsedFile, () => ({}), false, validate);
}

function validate(parsedMetadata: unknown): { "value": InstanceStatesType; "valid": boolean } {
  log.debug(__PRE_BUNDLED_FILENAME__, "Validating the instances metadata");

  const isRecord = typeof parsedMetadata === "object" && parsedMetadata !== null
    && !Array.isArray(parsedMetadata);
  const validInstances: InstanceStatesType = {};
  let allValid = isRecord;

  for (const [currentId, currentMetadata] of Object.entries(isRecord ? parsedMetadata : {})) {
    const instance: InstanceStateType | false = Schemas.validate.instance({
      "value": currentMetadata,
      "label": "instance",
      "info" : {
        "id": currentId,
      },
    });

    if (instance === false) {
      allValid = false;

      continue;
    }

    validInstances[currentId] = currentMetadata;
  }

  return { "value": validInstances, "valid": allValid };
}
