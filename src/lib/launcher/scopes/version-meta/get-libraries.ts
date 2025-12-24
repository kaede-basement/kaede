import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export async function getLibraries({
  baseDirectory,
  libraries,
  currentStatuses,
}: {
  "baseDirectory"  : string;
  "libraries"      : MetaMinecraftVersionType["libraries"];
  "currentStatuses": LauncherStatusesType;
}): Promise<string> {}
