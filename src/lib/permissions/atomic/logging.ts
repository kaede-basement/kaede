import "ses";

import { readTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";

function getLogPath(): string {
  return FileManager.join(
    FileManager.getBaseDirectory(),
    FileStructure.Folders.Logs.Path,
    FileStructure.Folders.Logs.Files.LatestLog,
  );
}

export function writePluginLog(
  id: string,
  level: "debug" | "info" | "warn" | "error",
  input: Array<string>,
): void {
  return log[level](`${id}`, ...input);
}

export async function readPluginLog(id: string): Promise<string> {
  const current: string = await readTextFile(getLogPath());

  log.debug(__PRE_BUNDLED_FILENAME__, `The '${id}' plugin has read logs`);

  return current;
}
