import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { cacheManifestV2 } from "@/lib/launcher/scopes/cache-manifest-v2.ts";
import {
  findInstanceInManifest,
} from "@/lib/launcher/scopes/find-instance-in-manifest.ts";
import { getManifestV2 } from "@/lib/launcher/scopes/get-manifest-v2.ts";
import { getVersionMetadata } from "@/lib/launcher/scopes/get-version-metadata.ts";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";
import type { ManifestV2Type } from "@/types/launcher/manifest-v2.type.ts";
import type { VersionMetadataType } from "@/types/launcher/version-metadata.type.ts";

export async function launchWithChecks({
  instanceId,
  changeStatus,
}: {
  "instanceId"  : string;
  "changeStatus": (newStatus: LaunchStatusType) => void;
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
    changeStatus,
    cachedManifestV2Path,
  });

  if (!manifest) {
    return changeStatus(LaunchStatus.Errors.InvalidManifestV2);
  }

  const manifestVersion = findInstanceInManifest({ instanceId, manifest });

  if (!manifestVersion) {
    return changeStatus(LaunchStatus.Errors.VersionNotFoundInManifestV2);
  }

  const []: [VersionMetadataType, void] = await Promise.all([
    getVersionMetadata({
      changeStatus,
      "url": manifestVersion.url,
    }),
    cacheManifestV2({ updateCache, manifest, cachedManifestV2Path }),
  ]);

  // const assetIndex = versionMetadata.assetIndex;

  return;
}