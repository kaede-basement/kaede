import { invoke, Resource } from "@tauri-apps/api/core";
import { exists, remove } from "@tauri-apps/plugin-fs";
import { watch } from "vue";

import FileStructure from "@/constants/file-structure.ts";
import Browser from "@/lib/browser";
import { getBaseDirectory, join } from "@/lib/file-manager/path.ts";
import { hasNativeStorage } from "@/lib/file-manager/storage-backend.ts";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";

const previewPins = new Map<string, number>;

export function stagingDirectory(): string {
  return join(getBaseDirectory(), FileStructure.Folders.Cache.Path, "mrpack-staging");
}

function ownedPath(path: string): boolean {
  const name = path.split(/[/\\]/).pop()!;

  return name.startsWith("modrinth-") && name.endsWith(".mrpack")
    && path === join(stagingDirectory(), name);
}

export function pinPreviewArchive(path: string): (() => Promise<void>) | undefined {
  if (!Browser.detectIsBrowser() || !ownedPath(path)) return;
  previewPins.set(path, (previewPins.get(path) ?? 0) + 1);

  return async () => {
    const count = previewPins.get(path)! - 1;

    if (count) {
      previewPins.set(path, count);

      return;
    }
    previewPins.delete(path);
    if (Object.values(instanceStates ?? {}).some(instance => instance.modpackPath === path)) return;
    if (await exists(path) && !previewPins.has(path)) await remove(path);
  };
}

let draft: { "path": string; "close": () => Promise<void> } | undefined;

export function collectStages(only?: string): Promise<void> {
  const protectedPaths = Object.values(instanceStates ?? {}).flatMap(instance => (
    instance.modpackPath ? [instance.modpackPath] : []
  ));

  const current = globalStates?.pages?.["add-instance"]?.importedModpack?.path;

  if (current) protectedPaths.push(current);

  return invoke("collect_stages", { only, "protected": protectedPaths });
}

function report(error: unknown): void {
  log.warn(__PRE_BUNDLED_FILENAME__, "Cannot clean modpack staging archive", String(error));
}

export function watchStaging(): void {
  watch(() => globalStates.pages["add-instance"]?.importedModpack?.path, current => {
    if (draft && current !== draft.path) {
      const previous = draft;

      draft = undefined;
      void previous.close().catch(report);
    }
  }, { "flush": "sync", "immediate": true });
  if (hasNativeStorage()) void collectStages().catch(report);
}

export async function selectArchive(path: string, select: () => Promise<boolean>): Promise<void> {
  let close = pinPreviewArchive(path);

  if (hasNativeStorage() && ownedPath(path)) {
    const rid = await invoke<number>("pin_stage", { path });

    if (rid == null) throw new Error("Cannot reserve modpack staging archive");
    const pin = new Resource(rid);

    close = async (): Promise<void> => {
      await pin.close();
      await collectStages(path);
    };
  }
  const stage = close && { path, close };
  let retained = false;

  try {
    const selected = await select();

    if (selected && stage && globalStates.pages["add-instance"]?.importedModpack?.path === path) {
      const previous = draft;

      draft = stage;
      retained = true;
      if (previous) await previous.close();
    }
  } finally {
    if (stage && !retained) await stage.close();
  }
}
