import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export async function getPatches({
  baseDirectory,
  requires,
  statuses,
}: {
  "baseDirectory": string;
  "requires"     : MetaMinecraftVersionType["requires"];
  "statuses"     : LauncherStatusesType;
}): Promise<string> {}
