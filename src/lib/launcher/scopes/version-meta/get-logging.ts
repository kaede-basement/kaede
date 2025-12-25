import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export async function getLogging({
  baseDirectory,
  logging,
  statuses,
}: {
  "baseDirectory": string;
  "logging"      : MetaMinecraftVersionType["logging"];
  "statuses"     : LauncherStatusesType;
}): Promise<string> {}
