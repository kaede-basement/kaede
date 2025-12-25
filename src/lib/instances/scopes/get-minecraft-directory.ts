import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";

export function getMinecraftDirectory({
  baseDirectory,
  instanceId,
}: {
  "baseDirectory": string;
  "instanceId"   : string;
}): string {
  return General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Instances.Path,
    instanceId,
    "minecraft",
  );
}
