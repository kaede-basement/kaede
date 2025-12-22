import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import Errors from "@/lib/errors";
import { cachedJoin } from "@/lib/general/scopes/cached-join.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function handleJsonFile({
  baseDirectory,
  path,
  label,
  defaultValue,
}: {
  "baseDirectory": string;
  "path"         : Array<string>;
  "label"        : string;
  "defaultValue" : unknown;
}): Promise<unknown> {
  const filePath: string = cachedJoin(baseDirectory, ...path);

  log.debug(`Checking if the '${label}' file exists`);
  const fileExists = await exists(filePath);

  if (!fileExists) {
    log.warn(`The '${label}' file does not exist`);
    log.debug(`Initializing the '${label}' file`);
    await writeTextFile(
      filePath,
      JSON.stringify(defaultValue, null, 2),
    );

    return defaultValue;
  }

  const storedFileData: string = await readTextFile(filePath);
  let parsed: unknown;

  try {
    parsed = JSON.parse(storedFileData);
  } catch (error: unknown) {
    log.error(`Could not parse the '${label}' file data:`, Errors.prettify(error));

    return defaultValue;
  }

  return parsed;
}