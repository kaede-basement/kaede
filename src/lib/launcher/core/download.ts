import { readTextFile } from "@tauri-apps/plugin-fs";
import { download } from "@tauri-apps/plugin-upload";
import Value from "typebox/value";

import {
  TreeAssetIndexes,
  TreeAssetObjects,
  TreeLibraries,
  TreeLogging,
  TreeNatives,
} from "@/constants/application";
import { log } from "@/lib/handlers/log";
import { checksum } from "@/lib/helpers/checksum";
import { extractError } from "@/lib/helpers/extract-error";
import { evaluateRules } from "@/lib/helpers/parse-rules";
import { transformPlatform } from "@/lib/helpers/transform-platform";
import { unzipFile } from "@/lib/helpers/unzip-file";
import { validateFileSize } from "@/lib/helpers/validate-file-size";
import {
  type Artifact,
  type Asset,
  type AssetIndex,
  AssetsValidator,
  type Classifiers,
  type Library,
  type LoggingConfig,
  type Manifest,
  VersionManifest,
  type VersionMetaModern,
} from "@/lib/schemas/minecrafts-schemas";

export async function fetchVersionManifest(): Promise<Manifest> {
  const raw = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest.json");

  return Value.Parse(VersionManifest, raw);
}

/* TODO: Add support for older versions */
export async function fetchVersionMeta(
  manifest: Manifest,
  version: string,
): Promise<VersionMetaModern> {
  const object = manifest.versions.find(version_ => version_.id = version);

  if (!object) {
    throw new Error(`Required version (${version}) not found in manifest`);
  }
  const raw = await fetch(object.url);

  return Value.Parse(VersionManifest, raw);
}

export async function downloadArtifact(artifact: Artifact, prefix: string): Promise<void> {
  const filePath = `${prefix}/${artifact.path}`;

  await download(artifact.url, filePath);

  await validateFileSize(filePath, artifact.size);
  await checksum(filePath, artifact.sha1);
}

export async function downloadAssetIndex(index: AssetIndex): Promise<string> {
  const path = `${TreeAssetIndexes}/${index.id}.json`;

  await download(index.url, path);

  await validateFileSize(path, index.size);
  await checksum(path, index.sha1);

  return path;
}

export async function downloadLoggingConfig(config: LoggingConfig): Promise<void> {
  const path = `${TreeLogging}/${config.id}`;

  await download(config.url, path);

  await validateFileSize(path, config.size);
  await checksum(path, config.sha1);
}

export async function downloadAsset(asset: Asset): Promise<unknown> {
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

export async function downloadAssets(path: string): Promise<void> {
  const index = await readTextFile(path)
    .then(async text => await JSON.parse(text));

  if (!AssetsValidator.Check(index)) {
    throw new TypeError(`Invalid AssetIndex ${path}`);
  }
  const objects: Asset[] = index.objects;
  const [] = objects.map(object => downloadAsset(object));

  /*
   * Kaeeraa code
   *
   * const results = await Promise.all(promises);
   * const errors = results.filter(result => result.success === false);
   */

  for (const error of []) {
    log.error(`Downloading asset (${path}) failed: ${error}`);
  }
}

export async function downloadClassifiers(
  classifiers: Classifiers,
  version: string,
  extract: boolean,
): Promise<void> {
  const platform = transformPlatform();
  const key = `natives-${platform}` as keyof typeof classifiers;
  const native = classifiers[key];

  if (!native) {
    throw new Error(`Expected native (${key}) not found`);
  }

  await downloadArtifact(native, `${TreeLibraries}`);

  if (extract) {
    const path = `${TreeLibraries}/${native.path}`;

    await unzipFile(path, `${TreeNatives}/${version}`);
  }
}

export async function downloadLibraries(libraries: Library[], version: string): Promise<void> {
  for (const library of libraries) {
    const rules = library.rules;

    if (rules && !await evaluateRules(rules)) {
      continue;
    }
    await downloadArtifact(library.downloads.artifact, TreeLibraries);

    if (library.downloads.classifiers) {
      await downloadClassifiers(
        library.downloads.classifiers,
        version,
        library.extract != undefined,
      );
    }
  }
}