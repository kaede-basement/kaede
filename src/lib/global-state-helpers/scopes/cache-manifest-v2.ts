import type { ManifestV2Type } from "@/types/launcher/manifest-v2.type.ts";

export async function cacheManifestV2({
  manifest,
  cachedManifestPath,
}: {
  "manifest"          : ManifestV2Type;
  "cachedManifestPath": string;
}): Promise<void> {
}