import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export async function getLibraries({
  baseDirectory,
  libraries,
  statuses,
}: {
  "baseDirectory": string;
  "libraries"    : MetaMinecraftVersionType["libraries"];
  "statuses"     : LauncherStatusesType;
}): Promise<string> {}
