import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getGameArguments({
  versionMeta,
}: {
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : {
    "libraries": Array<MappedArtifactType>;
    "natives"  : Array<MappedArtifactType>;
    "logging"  : (MappedArtifactType & {
      "argument": string;
    }) | false;
    "client"   : MappedArtifactType;
    "patches"  : LibraryArtifactsType;
    "mainClass": string | undefined;
  };
}): Promise<string> {
  if (versionMeta?.minecraftArguments === undefined) {
    throw new Error("No minecraft arguments found in the version metadata");
  }

  return versionMeta.minecraftArguments;
}
