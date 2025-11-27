import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

export async function readAllMetadata(): Promise<Array<ExtensionMetadataType>> {
  const extensionsPath = GlobalStateHelpers.get().fileSystem?.folders?.extensions;

  if (!extensionsPath) {
    log.error("The extensions folder path in global states is undefined");

    return [];
  }

  const metadataPath = General.cachedJoin(extensionsPath, FileStructure.Extensions.Name);

  log.debug("Reading the extensions metadata file");
  let metadata: string;

  try {
    metadata = await readTextFile(metadataPath);
  } catch (error: unknown) {
    metadata = "[]";

    log.error(
      "Could not read the extensions metadata file (re-creating it):",
      Errors.prettify(error),
    );
    await writeTextFile(metadataPath, "[]");
  }

  log.debug("Parsing the extensions metadata file");
  let parsedMetadata: unknown;

  try {
    parsedMetadata = JSON.parse(metadata);
  } catch (error: unknown) {
    log.error("Could not parse extensions metadata file:", Errors.prettify(error));

    return [];
  }

  if (!Array.isArray(parsedMetadata)) {
    log.error("The parsed extensions metadata is not an array");

    return [];
  }

  const validatedMetadataEntries: Array<ExtensionMetadataType> = [];

  for (const [index, unknownEntry] of parsedMetadata.entries()) {
    const _info = `(id: ${unknownEntry?.id}, index ${index})`;

    log.debug(`Checking if the provided extension metadata entry ${_info} is valid`);
    const validated: boolean = Schemas.ExtensionMetadataValidator.Check(unknownEntry);

    if (!validated) {
      log.warn(`The provided extension metadata entry ${_info} is not valid`);

      continue;
    }

    log.debug(`The provided extension metadata entry ${_info} is valid`);
    validatedMetadataEntries.push(unknownEntry);
  }

  return validatedMetadataEntries;
}