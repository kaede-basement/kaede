import {
  AssetsValidator,
  VersionManifest,
  type Artifact,
  type Asset,
  type AssetIndex,
  type LoggingConfig,
  type Manifest,
  type VersionMetaModern,
} from "@/lib/schemas/minecrafts-schemas";
import { download } from "@tauri-apps/plugin-upload";
import { checksum, validateFileSize } from "./utilities";
import Value from "typebox/value";
import { TreeAssetIndexes, TreeAssetObjects, TreeLogging } from "@/constants/application";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { extractError } from "@/lib/helpers/extract-error";
import { log } from "@/lib/handlers/log";


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

async function downloadLoggingConfig(config: LoggingConfig) {
  const path = `${TreeLogging}/${config.id}`;

  await download(config.url, path);

  await validateFileSize(path, config.size);
  await checksum(path, config.sha1);
}

async function downloadAsset(asset: Asset) {
  const twoBytes = asset.hash.slice(0, 2);
  const uri = `${twoBytes}/${asset.hash}`;
  const url = `https://resources.download.minecraft.net/${uri}`;
  const path = `${TreeAssetObjects}/${uri}`;

  try {
    await download(url, path);

    await validateFileSize(path, asset.size);
    await checksum(path, asset.hash);
  } catch (error: unknown) {
    const extracted = extractError(error);

    return { "success": false, "reason": extracted.message };
  }

  return { "success": true };
}

async function downloadAssets(path: string) {
  const index = await readTextFile(path)
    .then(async text => await JSON.parse(text));

  if (!AssetsValidator.Check(index)) {
    throw new TypeError(`Invalid AssetIndex ${path}`);
  }
  const objects: Asset[] = index.objects;
  const promises = objects.map(object => downloadAsset(object));
  const results = await Promise.all(promises);
  const errors = results.filter(result => result.success === false);

  for (const error of errors) {
    log.error(`Downloading asset (${path}) failed: ${error.reason}`);
  }
}
