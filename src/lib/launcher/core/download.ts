import type { Artifact } from "@/lib/schemas/minecrafts-schemas";
import { download } from "@tauri-apps/plugin-upload";
import { checksum, validateFileSize } from "./utilities";


async function downloadVersionManifest(): Promise<Response> {
  return fetch("https://piston-meta.mojang.com/mc/game/version_manifest.json");
}

async function downloadArtifact(artifact: Artifact, prefix: string): Promise<boolean> {
  const filePath = `${prefix}/${artifact.path}`;

  await download(artifact.url, filePath);

  return await validateFileSize(filePath, artifact.size)
    && await checksum(filePath, artifact.sha1);
}