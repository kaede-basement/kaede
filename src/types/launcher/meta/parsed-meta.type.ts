import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";

export type ParsedMetaType = {
  "libraries": Array<MappedArtifactType>;
  "natives"  : Array<MappedArtifactType>;
  "logging"  : (MappedArtifactType & {
    "argument": string;
  }) | false;
  "client"   : MappedArtifactType;
  "patches"  : LibraryArtifactsType;
  "mainClass": string | undefined;
};
