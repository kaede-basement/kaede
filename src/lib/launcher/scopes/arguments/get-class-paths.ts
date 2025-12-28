import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function getClassPaths({
  client,
  necessaries,
  versionMeta,
}: {
  "client"     : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<{
  "argument"  : string;
  "classPaths": string;
}> {
  return {
    "argument"  : "-cp ${classpath}",
    "classPaths": "",
  };
}
