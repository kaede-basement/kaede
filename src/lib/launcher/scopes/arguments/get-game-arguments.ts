import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function getGameArguments({
  client,
  necessaries,
  versionMeta,
}: {
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : {
    "libraries": Array<MappedArtifactType>;
    "natives"  : Array<MappedArtifactType>;
    "logging"  : MappedArtifactType & {
      "argument": string;
    };
    "client"   : MappedArtifactType;
    "patches"  : LibraryArtifactsType;
    "mainClass": string;
  };
}): Promise<string> {
  return "--username windstone_ --version 1.16.5 --gameDir C:/Users/windstone/AppData/Roaming/kaede/instances/fabulously-optimized/minecraft --assetsDir C:/Users/windstone/AppData/Roaming/kaede/assets --assetIndex 1.16 --uuid 3206b5f6-acd3-419e-a297-7d120f510767 --accessToken asdf --userType msa --versionType release";
}
