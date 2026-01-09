import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

export async function readAllMetadata(): Promise<Array<ExtensionMetadataType>> {
  const metadataPath = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Files.Extensions,
  );

  log.debug("Checking if extensions metadata file exists");
  const metadataExists = await exists(metadataPath);

  if (!metadataExists) {
    log.warn(__PRE_BUNDLED_FILENAME__, "Extensions metadata file does not exist");
    log.debug("Initializing an extensions metadata file");
    await writeTextFile(metadataPath, "[]");
  }

  log.debug("Extensions metadata file exists. Reading an extensions metadata file");
  const metadata = await readTextFile(metadataPath);

  log.debug("Parsing the extensions metadata file");
  let parsedMetadata: unknown;

  try {
    parsedMetadata = JSON.parse(metadata);
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not parse extensions metadata file:",
      Errors.prettify(error),
    );

    return [];
  }

  if (!Array.isArray(parsedMetadata)) {
    log.error(__PRE_BUNDLED_FILENAME__, "The parsed extensions metadata is not an array");

    return [];
  }

  const validatedMetadataEntries: Array<ExtensionMetadataType> = [];

  for (const [index, entry] of parsedMetadata.entries()) {
    const extension: ExtensionMetadataType | false = Schemas.validate.extension({
      "value": entry,
      "label": "extension metadata",
      "info" : {
        "id"   : entry?.id,
        "index": index,
      },
    });

    if (extension !== false) {
      validatedMetadataEntries.push(extension);
    }
  }

  return validatedMetadataEntries;
}
