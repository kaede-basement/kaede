import { getPatch } from "@/lib/launcher/scopes/patches/get-patch.ts";
import type {
  LauncherStatusesType,
} from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export async function getPatches({
  baseDirectory,
  requires,
  statuses,
}: {
  "baseDirectory": string;
  "requires"     : MetaMinecraftVersionType["requires"];
  "statuses"     : LauncherStatusesType;
}): Promise<string> {
  const patches: Array<object> = await Promise.all(
    requires.map(require => getPatch({
      baseDirectory,
      statuses,
      require,
    })),
  );
}
