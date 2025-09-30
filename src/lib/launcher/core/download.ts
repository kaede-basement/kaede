import {
  VersionManifest,
  type Artifact,
  type AssetIndex,
  // eslint-disable-next-line unicorn/no-abusive-eslint-disable
  // eslint-disable-next-line
  // type Logging,
  type LoggingConfig,
  type Manifest,
  type VersionMetaModern,
} from "@/lib/schemas/minecrafts-schemas";
import { download } from "@tauri-apps/plugin-upload";
import { checksum, validateFileSize } from "./utilities";
import Value from "typebox/value";
import { TreeAssetIndexes, TreeLogging } from "@/constants/application";


// eslint-disable-next-line unicorn/no-abusive-eslint-disable
// eslint-disable-next-line
async function fetchVersionManifest(): Promise<Manifest> {
  const raw = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest.json");

  return Value.Parse(VersionManifest, raw);
}

/* TODO: Add support for older versions */
// eslint-disable-next-line unicorn/no-abusive-eslint-disable
// eslint-disable-next-line
async function fetchVersionMeta(manifest: Manifest, version: string): Promise<VersionMetaModern> {
  const object = manifest.versions.find(version_ => version_.id = version);

  if (!object) {
    throw new Error(`Required version (${version}) not found in manifest`);
  }
  const raw = await fetch(object.url);

  return Value.Parse(VersionManifest, raw);
}

// eslint-disable-next-line unicorn/no-abusive-eslint-disable
// eslint-disable-next-line
async function downloadArtifact(artifact: Artifact, prefix: string) {
  const filePath = `${prefix}/${artifact.path}`;

  await download(artifact.url, filePath);

  await validateFileSize(filePath, artifact.size);
  await checksum(filePath, artifact.sha1);
}

// eslint-disable-next-line unicorn/no-abusive-eslint-disable
// eslint-disable-next-line
async function downloadAssetIndex(index: AssetIndex): Promise<string> {
  const path = `${TreeAssetIndexes}/${index.id}.json`;

  await download(index.url, path);

  await validateFileSize(path, index.size);
  await checksum(path, index.sha1);

  return path;
}

// eslint-disable-next-line unicorn/no-abusive-eslint-disable
// eslint-disable-next-line
async function downloadLoggingConfig(config: LoggingConfig) {
  const path = `${TreeLogging}/${config.id}`;

  await download(config.url, path);

  await validateFileSize(path, config.size);
  await checksum(path, config.sha1);
}

// eslint-disable-next-line unicorn/no-abusive-eslint-disable
// eslint-disable-next-line
const _ = () => console.log(downloadLoggingConfig, downloadAssetIndex, fetchVersionManifest, fetchVersionMeta, downloadArtifact);

_();