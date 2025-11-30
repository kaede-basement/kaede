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
    log.warn("Extensions metadata file does not exist");
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
    log.error("Could not parse extensions metadata file:", Errors.prettify(error));

    return [];
  }

  if (!Array.isArray(parsedMetadata)) {
    log.error("The parsed extensions metadata is not an array");

    return [];
  }

  const validatedMetadataEntries: Array<ExtensionMetadataType> = [];

  for (const [index, unknownEntry] of parsedMetadata.entries()) {
    const info = `(id: ${unknownEntry?.id}, index ${index})`;

    log.debug(`Checking if the provided extension metadata entry ${info} is valid`);
    const validated: boolean = Schemas.ExtensionMetadataValidator.Check(unknownEntry);

    if (!validated) {
      log.warn(
        `The provided extension metadata entry ${info} is not valid:`,
        "\n" + JSON.stringify(
          Schemas.ExtensionMetadataValidator.Errors(unknownEntry),
          null,
          2,
        ),
      );

      continue;
    }

    log.debug(`The provided extension metadata entry ${info} is valid`);
    validatedMetadataEntries.push(unknownEntry);
  }

  return validatedMetadataEntries;
}