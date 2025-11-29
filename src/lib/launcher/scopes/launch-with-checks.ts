import { LaunchStatus } from "@/constants/launcher.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import {
  findInstanceInManifest,
} from "@/lib/launcher/scopes/find-instance-in-manifest.ts";
import {
  getCachedManifestV2Path,
} from "@/lib/launcher/scopes/get-cached-manifest-v2-path.ts";
import { getManifestV2 } from "@/lib/launcher/scopes/get-manifest-v2.ts";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";
import type { ManifestV2Type } from "@/types/launcher/manifest-v2.type.ts";

export async function launchWithChecks({
  instanceId,
  changeStatus,
}: {
  "instanceId"  : string;
  "changeStatus": (newStatus: LaunchStatusType) => void;
}): Promise<void> {
  const fileSystemStates = GlobalStateHelpers.get()?.fileSystem;
  const cachedManifestV2Path: string = getCachedManifestV2Path(fileSystemStates);
  const { cached, manifest }: {
    "cached"  : boolean;
    "manifest": ManifestV2Type | false;
  } = await getManifestV2({
    changeStatus,
    cachedManifestV2Path,
  });

  if (!manifest) {
    return changeStatus(LaunchStatus.Errors.InvalidManifestV2);
  }

  const manifestVersion = findInstanceInManifest({ instanceId, manifest });

  return;
}