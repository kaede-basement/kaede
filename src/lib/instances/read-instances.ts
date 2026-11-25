import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { publishText } from "@/lib/file-manager/publish-text.ts";
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
  const parsedFile: ParsedFile | undefined = properties?.parsedFile;
  const parsedMetadata: unknown = parsedFile?.status === "loaded"
    ? parsedFile.data
    : await FileManager.handleJsonFile({
      baseDirectory,
      "stateFile"      : "instances",
      "corrupt"        : parsedFile?.status === "corrupt",
      "path"           : [FileStructure.Files.Metadata],
      "label"          : FileStructure.Files.Metadata,
      "getDefaultValue": async (): Promise<object> => ({}),
    });

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

  if (allValid) {
    log.info(__PRE_BUNDLED_FILENAME__, "All specified metadata instances are valid");
  } else {
    await publishText(FileManager.join(baseDirectory, FileStructure.Files.Metadata),
      JSON.stringify(validInstances, null, 2),
      false,
      true,
      JSON.stringify(parsedMetadata));
  }

  return validInstances;
}
