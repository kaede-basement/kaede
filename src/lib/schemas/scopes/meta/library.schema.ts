import { Type } from "typebox";

export const ArtifactSchema = Type.Object({
  "sha1": Type.String(),
  "size": Type.Number(),
  "url" : Type.String(),
});

export const LibraryDownloadsSchema = Type.Object({
  "artifact"   : ArtifactSchema,
  "classifiers": Type.Optional(
    Type.Object({
      "natives-linux": Type.Optional(
        ArtifactSchema,
      ),
      "natives-windows": Type.Optional(
        ArtifactSchema,
      ),
      "natives-osx": Type.Optional(
        ArtifactSchema,
      ),
    }),
  ),
});
export const LibraryExtractSchema = Type.Object({
  "exclude": Type.Array(
    Type.String(),
  ),
});
export const LibraryNativesSchema = Type.Object({
  "linux": Type.Optional(
    Type.String(),
  ),
  "windows": Type.Optional(
    Type.String(),
  ),
  "osx": Type.Optional(
    Type.String(),
  ),
});
export const LibraryRuleSchema = Type.Object({
  "action": Type.String(),
  "os"    : Type.Object({
    "name": Type.String(),
  }),
});

export const LibrarySchema = Type.Object({
  "downloads": LibraryDownloadsSchema,
  "name"     : Type.String(),
  "extract"  : Type.Optional(
    LibraryExtractSchema,
  ),
  "natives": Type.Optional(
    LibraryNativesSchema,
  ),
  "rules": Type.Optional(
    Type.Array(
      LibraryRuleSchema,
    ),
  ),
});
