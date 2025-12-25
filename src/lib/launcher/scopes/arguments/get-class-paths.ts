import type { Platform } from "@tauri-apps/plugin-os";

import type { DirectoriesType } from "@/types/launcher/launch/directories.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export async function getClassPaths({
  currentPlatform,
  versionMeta,
  directories,
}: {
  "currentPlatform": Platform;
  "versionMeta"    : MetaMinecraftVersionType;
  "directories"    : DirectoriesType;
}): Promise<{
  "argument"  : string;
  "classPaths": string;
}> {
  return {
    "argument"  : "-cp ${classpath}",
    "classPaths": "",
  };
}
