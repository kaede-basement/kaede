import {
  VersionManifest,
  type Artifact,
  type AssetIndex,
  type Manifest,
  type VersionMetaModern,
} from "@/lib/schemas/minecrafts-schemas";
import { download } from "@tauri-apps/plugin-upload";
import { checksum, validateFileSize } from "./utilities";
import Value from "typebox/value";
import { TreeAssetIndexes } from "@/constants/application";


async function fetchVersionManifest(): Promise<Manifest> {
  const raw = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest.json");

  return Value.Parse(VersionManifest, raw);
}

/* TODO: Add support for older versions */
async function fetchVersionMeta(manifest: Manifest, version: string): Promise<VersionMetaModern> {
  const object = manifest.versions.find(version_ => version_.id = version);

  if (!object) {
    throw new Error(`Required version (${version}) not found in manifest`);
  }
  const raw = await fetch(object.url);

  return Value.Parse(VersionManifest, raw);
}

async function downloadArtifact(artifact: Artifact, prefix: string) {
  const filePath = `${prefix}/${artifact.path}`;

  await download(artifact.url, filePath);

  await validateFileSize(filePath, artifact.size);
  await checksum(filePath, artifact.sha1);
}

async function downloadAssetIndex(index: AssetIndex): Promise<string> {
  const path = `${TreeAssetIndexes}/${index.id}.json`;

  await download(index.url, path);

  await validateFileSize(path, index.size);
  await checksum(path, index.sha1);

  return path;
}
