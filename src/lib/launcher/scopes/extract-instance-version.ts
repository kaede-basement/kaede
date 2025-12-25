import { LaunchStatus } from "@/constants/launcher.ts";
import Instances from "@/lib/instances";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta-manifest.type.ts";

export function extractInstanceVersion({
  statuses,
  instanceId,
}: {
  "statuses"  : LauncherStatusesType;
  "instanceId": string;
}): MetaMinecraftVersionType["version"] | undefined {
  const instanceStates = Instances.get();
  const currentInstanceStates = instanceStates[instanceId];

  if (currentInstanceStates === undefined) {
    statuses.add(LaunchStatus.Errors.UndefinedInstanceVersion);

    return undefined;
  }

  return currentInstanceStates.version;
}
