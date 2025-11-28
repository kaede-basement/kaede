import { LaunchStatus } from "@/constants/launcher.ts";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";

export async function launchWithChecks({
  instanceId,
}: {
  "instanceId": string;
}): Promise<LaunchStatusType> {
  return LaunchStatus.Success;
}