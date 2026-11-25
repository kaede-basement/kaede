import { invoke, Resource } from "@tauri-apps/api/core";
import { watch } from "vue";

import { getBaseDirectory, join } from "@/lib/file-manager/path.ts";
import { hasNativeStorage } from "@/lib/file-manager/storage-backend.ts";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";

let draft: { "path": string; "pin": Resource } | undefined;

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

async function release(stage: NonNullable<typeof draft>): Promise<void> {
  await stage.pin.close();
  await collectStages(stage.path);
}

export function watchStaging(): void {
  watch(() => globalStates.pages["add-instance"]?.importedModpack?.path, current => {
    if (draft && current !== draft.path) {
      const previous = draft;

      draft = undefined;
      void release(previous).catch(report);
    }
  }, { "flush": "sync", "immediate": true });
  void collectStages().catch(report);
}

export async function selectArchive(path: string, select: () => Promise<boolean>): Promise<void> {
  const name = path.split(/[/\\]/).pop()!;
  const owned = hasNativeStorage() && name.startsWith("modrinth-")
    && path === join(getBaseDirectory(), "cache", name) && name.endsWith(".mrpack");
  const rid = owned ? await invoke<number>("pin_stage", { path }) : undefined;

  if (owned && rid == null) throw new Error("Cannot reserve modpack staging archive");
  const stage = rid == null ? undefined : { path, "pin": new Resource(rid) };

  let retained = false;

  try {
    const selected = await select();

    if (selected && stage && globalStates.pages["add-instance"]?.importedModpack?.path === path) {
      const previous = draft;

      draft = stage;
      retained = true;
      if (previous) await release(previous);
    }
  } finally {
    if (stage && !retained) await release(stage);
  }
}
