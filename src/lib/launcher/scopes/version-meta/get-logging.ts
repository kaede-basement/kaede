import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export async function getLogging({
  baseDirectory,
  logging,
  currentStatuses,
}: {
  "baseDirectory"  : string;
  "logging"        : MetaMinecraftVersionType["logging"];
  "currentStatuses": LauncherStatusesType;
}): Promise<string> {}
