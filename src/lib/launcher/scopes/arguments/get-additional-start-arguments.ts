import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getAdditionalStartArguments({
  javaBinary,
}: {
  "javaBinary" : "java" | "cmd";
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
  return javaBinary === "cmd" ? "/C javaw" : "";
}
