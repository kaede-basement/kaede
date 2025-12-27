import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export function getGameArguments({
  client,
  necessaries,
  versionMeta,
}: {
  "client"     : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<string> {
  return "--username windstone_ --version 1.16.5 --gameDir C:/Users/windstone/AppData/Roaming/kaede/instances/fabulously-optimized/minecraft --assetsDir C:/Users/windstone/AppData/Roaming/kaede/assets --assetIndex 1.16 --uuid 3206b5f6-acd3-419e-a297-7d120f510767 --accessToken asdf --userType msa --versionType release";
}
