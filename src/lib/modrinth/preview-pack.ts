import { invoke } from "@tauri-apps/api/core";
import { exists, mkdir, remove, rename, writeFile } from "@tauri-apps/plugin-fs";

import { getBaseDirectory, join } from "@/lib/file-manager/path.ts";
import { createRequestId } from "@/lib/network/create-request-id.ts";
import { fetchDocument } from "@/lib/network/fetch-document.ts";
import type { MrpackManifestType } from "@/types/modrinth/mrpack.type.ts";

import type { PackFile } from "./select-pack.ts";

export async function downloadPreviewPack(file: PackFile, signal: AbortSignal):
Promise<{ "manifest": MrpackManifestType; "path": string }> {
  const response = await fetchDocument(file.url, { signal });

  if (!response.ok) throw new Error(`HTTP ${response.status} downloading modpack`);
  const bytes = await response.arrayBuffer();

  if (bytes.byteLength !== file.size) throw new Error("Modpack size mismatch");
  const hashes = [["SHA-512", file.hashes.sha512], ["SHA-1", file.hashes.sha1]];

  for (const [algorithm, expected] of hashes) {
    signal.throwIfAborted();
    const hash = new Uint8Array(await crypto.subtle.digest(algorithm, bytes));
    const hex = [...hash].map(byte => byte.toString(16).padStart(2, "0")).join("");

    if (hex !== expected.toLowerCase()) throw new Error("Modpack hash mismatch");
  }
  const cache = join(getBaseDirectory(), "cache");
  const path = join(cache, file.hashes.sha512.toLowerCase() + ".mrpack");
  const temporary = join(cache, createRequestId() + ".part");

  await mkdir(cache, { "recursive": true });
  try {
    signal.throwIfAborted();
    await writeFile(temporary, new Uint8Array(bytes));
    const manifest = await invoke<MrpackManifestType | null>("peek_mrpack", {
      "archivePath": temporary,
    });

    if (!manifest) throw new Error("Missing modrinth.index.json");
    signal.throwIfAborted();
    await rename(temporary, path);

    return { manifest, path };
  } finally {
    if (await exists(temporary)) await remove(temporary);
  }
}
