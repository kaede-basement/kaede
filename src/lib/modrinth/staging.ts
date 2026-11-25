import { invoke, Resource } from "@tauri-apps/api/core";
import { exists, readDir, readTextFile, remove } from "@tauri-apps/plugin-fs";
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

function referenced(path: string): boolean {
  const draftPath = globalStates?.pages?.["add-instance"]?.importedModpack?.path;

  return previewPins.has(path) || draftPath === path
    || Object.values(instanceStates ?? {}).some(instance => instance.modpackPath === path);
}

async function removePreview(path: string): Promise<void> {
  if (!ownedPath(path)) return;
  const removeUnused = async (): Promise<void> => {
    if (!referenced(path) && await exists(path) && !referenced(path)) await remove(path);
  };
  const locks = globalThis.navigator?.locks;

  await (locks ? locks.request("kaede-stage:" + path, { "ifAvailable": true }, async lock => {
    if (lock) await removeUnused();
  }) : removeUnused());
}

export async function pinPreviewArchive(path: string): Promise<() => Promise<void>> {
  previewPins.set(path, (previewPins.get(path) ?? 0) + 1);
  const locks = globalThis.navigator?.locks;
  let unlock: (() => void) | undefined;
  let held: Promise<void> | undefined;

  if (locks) {
    const lifetime = new Promise<void>(resolve => {
      unlock = resolve;
    });

    await new Promise<void>((resolve, reject) => {
      held = locks.request("kaede-stage:" + path, { "mode": "shared" }, () => {
        resolve();

        return lifetime;
      });
      held.catch(reject);
    }).catch(error => {
      unpin();
      throw error;
    });
  }
  function unpin(): void {
    const count = previewPins.get(path)! - 1;

    if (count) previewPins.set(path, count);
    else previewPins.delete(path);
  }

  return async () => {
    unpin();
    unlock?.();
    await held;
    await removePreview(path);
  };
}

export function previewArchive(path: string): boolean {
  return Browser.detectIsBrowser() && ownedPath(path);
}

async function collectPreview(): Promise<void> {
  // Only the owning page can safely release a stage when other tabs cannot advertise pins.
  if (!globalThis.navigator?.locks) return;
  const folder = stagingDirectory();
  const entries = await readDir(folder);
  const paths = entries.filter(entry => entry.isFile && !entry.isSymlink)
    .map(entry => join(folder, entry.name))
    .filter(path => ownedPath(path));

  if (paths.length === 0) return;
  const persisted = join(getBaseDirectory(), FileStructure.Files.Metadata);
  const legacy = (new Set<string>);

  if (await exists(persisted)) {
    const text = await readTextFile(persisted);
    const json = text.replace(/^\uFEFF/, "");
    const instances: Record<string, { "modpackPath"?: string }> = JSON.parse(json);

    for (const instance of Object.values(instances)) {
      if (instance.modpackPath) legacy.add(instance.modpackPath);
    }
  }
  for (const path of paths) {
    if (!legacy.has(path)) await removePreview(path).catch(report);
  }
}

let draft: { "path": string; "close": () => Promise<void> } | undefined;

export function collectStages(only?: string): Promise<void> {
  if (Browser.detectIsBrowser()) return only ? removePreview(only) : collectPreview();
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
  void collectStages().catch(report);
}

export async function selectArchive(path: string, select: () => Promise<boolean>): Promise<void> {
  let close = previewArchive(path) ? await pinPreviewArchive(path) : undefined;

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
