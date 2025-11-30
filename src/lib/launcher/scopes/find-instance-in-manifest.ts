import Instances from "@/lib/instances";
import type { ManifestV2Type } from "@/types/launcher/manifest-v2.type.ts";

export function findInstanceInManifest({
  instanceId,
  manifest,
}: {
  "instanceId": string;
  "manifest"  : ManifestV2Type;
}): ManifestV2Type["versions"][number] | false {
  const instanceStates = Instances.get();
  const currentInstanceStates = instanceStates[instanceId];
  const currentInstanceVersion = currentInstanceStates?.version;

  if (!currentInstanceStates) {
    return false;
  }

  const found: ManifestV2Type["versions"][number] | undefined = manifest.versions.find(
    (manifestVersion: ManifestV2Type["versions"][number]) => {
      return manifestVersion.id === currentInstanceVersion;
    },
  );

  return found ?? false;
}