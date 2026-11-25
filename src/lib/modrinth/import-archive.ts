import { remove, writeTextFile } from "@tauri-apps/plugin-fs";

import Hashing from "@/lib/hashing.ts";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

// Only archives exclusively created by this launcher can be released.
const owners = new Map<string, number>;

export async function reserveImportArchive(path: string): Promise<void> {
  // Reserve the name first so a failed binary write can safely remove its partial file.
  await writeTextFile(path, "", { "createNew": true });
  owners.set(path, 1);
}

export async function archiveIdentity(path: string): Promise<string> {
  // A download exclusively owns its unique cache path; a picked local file can be replaced.
  return owners.has(path) ? path : Hashing.hashPath(path, Hashing.Algorithms.SHA256);
}

export function persistImportArchive(path: string): void {
  // A legacy instance can need this path for repairs across application restarts.
  owners.delete(path);
}

export function retainArchive(path?: string): void {
  const count = path && owners.get(path);

  if (path && count) {
    owners.set(path, count + 1);
  }
}

export function releaseArchive(path?: string): void {
  const count = path && owners.get(path);

  if (!path || !count) {
    return;
  }
  if (count > 1) {
    owners.set(path, count - 1);

    return;
  }
  owners.delete(path);
  void remove(path).catch(error => {
    log.warn(__PRE_BUNDLED_FILENAME__, "Could not remove cached modpack archive:", path, error);
  });
}

export function setImportedModpack(
  draft?: GlobalStatesType["pages"]["add-instance"]["importedModpack"],
): void {
  const page = globalStates.pages["add-instance"];
  const previous = page.importedModpack;

  retainArchive(draft?.path);
  page.importedModpack = draft;
  releaseArchive(previous?.path);
}
