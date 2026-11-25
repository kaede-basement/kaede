import { invoke } from "@tauri-apps/api/core";
import { onScopeDispose, type Ref, ref } from "vue";

import { createRequestId } from "@/lib/network/create-request-id.ts";
import { HttpBackend } from "@/lib/network/http-backend.ts";
import type { MrpackManifestType } from "@/types/modrinth/mrpack.type.ts";

import type { fetchVersion } from "./fetch-version.ts";

type Files = Awaited<ReturnType<typeof fetchVersion>>[number]["files"];
type Pack = { "manifest": MrpackManifestType; "path": string };

export type PackFile = {
  "url"   : string;
  "hashes": { "sha512": string; "sha1": string };
  "size"  : number;
};

function selectFile(files: Files): PackFile {
  const packs = files.filter(file => file.filename?.toLowerCase().endsWith(".mrpack"));
  const primary = packs.filter(file => file.primary);
  const file = primary[0] ?? packs[0];

  if (!file) throw new Error("Version has no .mrpack file");
  if (primary.length > 1) throw new Error("Version has multiple primary .mrpack files");

  if (!file.url || file.size === undefined || !Number.isSafeInteger(file.size) || file.size < 0
    || !file.hashes?.sha1 || !file.hashes.sha512) {
    throw new Error("Missing modpack URL, size or hashes");
  }

  return { "url": file.url, "hashes": file.hashes, "size": file.size };
}

export function usePackSelection(apply: (pack: Pack) => void): {
  "pending": Ref<string | undefined>;
  "failure": Ref<string>;
  "select" : (files: Files) => Promise<void>;
  "stop"   : () => void;
} {
  const pending = ref<string>();
  let preview: AbortController | undefined;
  const failure = ref("");
  const stop = (): void => {
    const cancelId = pending.value;

    if (!cancelId) return;
    pending.value = undefined;
    if (preview) {
      preview.abort();
      preview = undefined;

      return;
    }
    void invoke("cancel_downloads", { cancelId }).catch(error => {
      failure.value = String(error);
    });
  };
  const select = async (files: Files): Promise<void> => {
    let cancelId: string | undefined;

    try {
      stop();
      failure.value = "";
      cancelId = createRequestId();
      pending.value = cancelId;
      const file = selectFile(files);
      let result: Pack;

      if (HttpBackend.current === "tauri") {
        result = await invoke<Pack>("download_mrpack", { cancelId, file });
      } else {
        preview = new AbortController;
        const { signal } = preview;
        const { downloadPreviewPack } = await import("./preview-pack.ts");

        result = await downloadPreviewPack(file, signal);
      }

      if (pending.value === cancelId) {
        apply(result);
      }
    } catch (error) {
      if (pending.value === cancelId) failure.value = String(error);
    } finally {
      if (pending.value === cancelId) {
        pending.value = undefined;
        preview = undefined;
      }
    }
  };

  onScopeDispose(stop);

  return { pending, failure, select, stop };
}
