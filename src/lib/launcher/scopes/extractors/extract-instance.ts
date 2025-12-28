import { LaunchStatus } from "@/constants/launcher.ts";
import Instances from "@/lib/instances";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";

export function extractInstance({
  statuses,
  instanceId,
}: {
  "statuses"  : LauncherStatusesType;
  "instanceId": string;
}): InstanceStateType | undefined {
  const instanceStates = Instances.get();
  const currentInstanceStates = instanceStates[instanceId];

  if (currentInstanceStates === undefined) {
    statuses.add(LaunchStatus.Errors.UndefinedInstanceVersion);

    return undefined;
  }

  return currentInstanceStates;
}
