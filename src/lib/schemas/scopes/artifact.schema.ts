import Type from "typebox";

export const ArtifactSchema = Type.Object({
  "path": Type.String(),
  "sha1": Type.String(),
  "size": Type.Number(),
  "url" : Type.String(),
});