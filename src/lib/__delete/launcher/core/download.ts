import { readTextFile } from "@tauri-apps/plugin-fs";
import { download } from "@tauri-apps/plugin-upload";
import Value from "typebox/value";

import {
  TreeAssetIndexes,
  TreeAssetObjects,
  TreeLibraries,
  TreeLogging,
  TreeNatives,
} from "@/constants/application.ts";
import Errors from "@/lib/errors";
import { checksum } from "@/lib/__delete/helpers/checksum.ts";
import { evaluateRules } from "@/lib/__delete/helpers/parse-rules.ts";
import { transformPlatform } from "@/lib/__delete/helpers/transform-platform.ts";
import { unzipFile } from "@/lib/__delete/helpers/unzip-file.ts";
import { validateFileSize } from "@/lib/__delete/helpers/validate-file-size.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import { VersionManifestSchema } from "@/lib/schemas/scopes/version-manifest.schema.ts";
import type {
  ArtifactType,
  AssetIndexType, AssetType, ClassifiersType, LibraryType,
  LoggingConfigType,
  VersionManifestType,
  VersionMetaModernType,
} from "@/types/minecraft/minecraft.type.ts";

export async function fetchVersionManifest(): Promise<VersionManifestType> {
  const raw = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest.json");

  return Value.Parse(VersionManifestSchema, raw);
}

/* TODO: Add support for older versions */
export async function fetchVersionMeta(
  manifest: VersionManifestType,
  version: string,
): Promise<VersionMetaModernType> {
  const object = manifest.versions.find(version_ => version_.id = version);

  if (!object) {
    throw new Error(`Required version (${version}) not found in manifest`);
  }
  const raw = await fetch(object.url);

  return Value.Parse(VersionManifestSchema, raw);
}

export async function downloadArtifact(artifact: ArtifactType, prefix: string): Promise<void> {
  const filePath = `${prefix}/${artifact.path}`;

  await download(artifact.url, filePath);

  await validateFileSize(filePath, artifact.size);
  await checksum(filePath, artifact.sha1);
}

export async function downloadAssetIndex(index: AssetIndexType): Promise<string> {
  const path = `${TreeAssetIndexes}/${index.id}.json`;

  await download(index.url, path);

  await validateFileSize(path, index.size);
  await checksum(path, index.sha1);

  return path;
}

export async function downloadLoggingConfig(config: LoggingConfigType): Promise<void> {
  const path = `${TreeLogging}/${config.id}`;

  await download(config.url, path);

  await validateFileSize(path, config.size);
  await checksum(path, config.sha1);
}

export async function downloadAsset(asset: AssetType): Promise<unknown> {
  const twoBytes = asset.hash.slice(0, 2);
  const uri = `${twoBytes}/${asset.hash}`;
  const url = `https://resources.download.minecraft.net/${uri}`;
  const path = `${TreeAssetObjects}/${uri}`;

  try {
    await download(url, path);

    await validateFileSize(path, asset.size);
    await checksum(path, asset.hash);
  } catch (error: unknown) {
    const extracted = Errors.extract(error);

    return { "success": false, "reason": extracted.message };
  }

  return { "success": true };
}

export async function downloadAssets(path: string): Promise<void> {
  const index = await readTextFile(path)
    .then(async text => await JSON.parse(text));

  if (!Schemas.AssetsValidator.Check(index)) {
    throw new TypeError(`Invalid AssetIndex ${path}`);
  }
  const objects: AssetType[] = index.objects;
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
  classifiers: ClassifiersType,
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

export async function downloadLibraries(libraries: LibraryType[], version: string): Promise<void> {
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