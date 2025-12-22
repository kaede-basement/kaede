import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { cacheManifestV2 } from "@/lib/launcher/scopes/cache-manifest-v2.ts";
import {
  findInstanceInManifest,
} from "@/lib/launcher/scopes/find-instance-in-manifest.ts";
import { getManifestV2 } from "@/lib/launcher/scopes/get-manifest-v2.ts";
import { getVersionMetadata } from "@/lib/launcher/scopes/get-version-metadata.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { ManifestV2Type } from "@/types/launcher/manifest-v2.type.ts";
import type { VersionMetadataType } from "@/types/launcher/version-metadata.type.ts";

export async function launchWithChecks({
  instanceId,
  currentStatuses,
}: {
  "instanceId"     : string;
  "currentStatuses": LauncherStatusesType;
}): Promise<void> {
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
}