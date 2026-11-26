import { exists, readTextFile } from "@tauri-apps/plugin-fs";

import Browser from "@/lib/browser";
import { join } from "@/lib/file-manager/path.ts";
import { log } from "@/lib/logging/log.ts";
import { CheckPatchMeta } from "@/lib/schemas/generated/validators.ts";
import { instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";

import { readOptional, rejectSymlink, safeComponent } from "./storage.ts";

type Patch = { "requires"?: Array<Dependency>; "assetIndex"?: { "id": string } };
type Dependency = { "uid": string; "equals"?: string; "suggests"?: string };

type Profile = Pick<InstanceStateType, "entry" | "patchVersions">;
const active = new Set<Profile>;

export function pinLaunchMetadata(profile: Profile): () => void {
  const snapshot = { "entry": profile.entry, "patchVersions": { ...profile.patchVersions } };

  active.add(snapshot);

  return () => {
    active.delete(snapshot);
  };
}

export async function offlineMetadata(root: string, baseDirectory?: string):
Promise<Set<string> | undefined> {
  try {
    return await collectOfflineMetadata(root, baseDirectory);
  } catch (error) {
    // An unreadable dependency can refer to any asset index or transitive patch.
    log.warn(__PRE_BUNDLED_FILENAME__, "Deferring metadata eviction", String(error));
  }
}

async function collectOfflineMetadata(root: string, baseDirectory?: string): Promise<Set<string>> {
  const protectedKeys = new Set<string>;
  const documents = new Map<string, unknown>;

  async function read(key: string): Promise<unknown> {
    protectedKeys.add(key.toLowerCase());
    if (!documents.has(key)) {
      let path = root;

      for (const part of key.split("/")) {
        await rejectSymlink(path);
        path = join(path, part);
      }
      const bytes = await readOptional(path);

      const previewEmpty = bytes?.length === 0 && Browser.detectIsBrowser();
      const absent = !bytes || (previewEmpty && !await exists(path));
      const decoder = new TextDecoder("utf8", { "fatal": true });

      documents.set(key, absent ? undefined : JSON.parse(decoder.decode(bytes)));
    }

    return documents.get(key);
  }
  const profiles: Array<Profile> = [...Object.values(instanceStates ?? {}), ...active];

  if (baseDirectory) {
    const persisted = join(baseDirectory, "instances.json");

    if (await exists(persisted)) {
      const text = await readTextFile(persisted);
      const otherWindows: Record<string, Profile> = JSON.parse(text.replace(/^\uFEFF/, ""));

      for (const instance of Object.values(otherWindows)) profiles.push(instance);
    }
  }
  for (const instance of profiles) {
    const selected: Record<string, string | undefined> = instance.patchVersions;
    const queue: Array<Dependency> = [{ "uid": instance.entry },
      ...Object.keys(selected).map(uid => ({ uid }))];
    const visited = new Set<string>;

    for (const dependency of queue) {
      const uid = dependency.uid;

      if (!safeComponent(uid)) continue;
      let version = selected[uid] ?? dependency.equals ?? dependency.suggests;

      if (version === undefined) {
        const index = await read(uid + ".json") as { "versions"?: Array<{ "version": string }> };

        if (index !== undefined && (!Array.isArray(index?.versions)
          || !safeComponent(index.versions[0]?.version))) throw new Error("Invalid version index");
        version = index?.versions?.[0]?.version;
      }
      if (!version || !safeComponent(version)) continue;
      const key = uid + "/" + version + ".json";

      if (visited.has(key)) continue;
      visited.add(key);
      const patch = await read(key) as Patch;

      if (patch !== undefined && !CheckPatchMeta(patch)) throw new Error("Invalid offline patch");
      if (Array.isArray(patch?.requires)) {
        for (const child of patch.requires) if (child) queue.push(child);
      }
      if (patch?.assetIndex && safeComponent(patch.assetIndex.id)) {
        protectedKeys.add(("asset-indexes/" + patch.assetIndex.id + ".json").toLowerCase());
      }
    }
  }

  return protectedKeys;
}
