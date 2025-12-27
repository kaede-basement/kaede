import type { Platform } from "@tauri-apps/plugin-os";

import type { DirectoriesType } from "@/types/launcher/launch/directories.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getClassPaths({
  currentPlatform,
  versionMeta,
  directories,
}: {
  "currentPlatform": Platform;
  "versionMeta"    : SpecificPatchMetaType;
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
