import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";

export type LibraryArtifactsType = {
  "libraries": Array<MappedArtifactType>;
  "natives"  : Array<MappedArtifactType>;
};
