import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { extractInstanceVersion } from "@/lib/launcher/scopes/extract-instance-version.ts";
import { getVersionMeta } from "@/lib/launcher/scopes/get-version-meta.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta-manifest.type.ts";

export async function launchWithChecks({
  instanceId,
  currentStatuses,
}: {
  "instanceId"     : string;
  "currentStatuses": LauncherStatusesType;
}): Promise<void> {
  const baseDirectory = General.getCachedBaseDirectory();
  const version = extractInstanceVersion({ instanceId });

  if (!version) {
    currentStatuses.value.add(LaunchStatus.Errors.UndefinedInstanceVersion);

    return;
  }

  const versionMeta: MetaMinecraftVersionType | undefined = await getVersionMeta({
    currentStatuses,
    baseDirectory,
    version,
  });

  if (versionMeta === undefined) {
    return;
  }

  /*

  const cachedManifestV2Path = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Folders.Cache.Path,
    FileStructure.Folders.Cache.Files.ManifestV2,
  );

  const { updateCache, manifest }: {
    "updateCache": boolean;
    "manifest"   : ManifestV2Type | false;
  } = await getManifestV2({
    currentStatuses,
    cachedManifestV2Path,
  });

  if (!manifest) {
    currentStatuses.value.add(LaunchStatus.Errors.InvalidManifestV2);

    return;
  }

  const manifestVersion = findInstanceInManifest({ instanceId, manifest });

  if (!manifestVersion) {
    currentStatuses.value.add(LaunchStatus.Errors.VersionNotFoundInManifestV2);

    return;
  }

  const []: [VersionMetadataType, void] = await Promise.all([
    getVersionMetadata({
      currentStatuses,
      "url": manifestVersion.url,
    }),
    cacheManifestV2({ updateCache, manifest, cachedManifestV2Path }),
  ]);

  // | const assetIndex = versionMetadata.assetIndex;

  return;
   */
}
