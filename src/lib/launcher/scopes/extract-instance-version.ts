import Instances from "@/lib/instances";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta-manifest.type.ts";

export function extractInstanceVersion({
  instanceId,
}: {
  "instanceId": string;
}): MetaMinecraftVersionType["version"] | undefined {
  const instanceStates = Instances.get();
  const currentInstanceStates = instanceStates[instanceId];

  return currentInstanceStates?.version;
}
