import { Type } from "typebox";

export const ArtifactSchema = Type.Object({
  "url" : Type.String(),
  "sha1": Type.String(),
  "size": Type.Number(),
  "path": Type.Optional(Type.String()),
  "id"  : Type.Optional(Type.String()),
});
export const LibraryDownloadsSchema = Type.Object({
  "artifact"   : Type.Optional(ArtifactSchema),
  "classifiers": Type.Optional(Type.Object({})),
});
export const LibraryExtractSchema = Type.Object({});
export const LibraryNativesSchema = Type.Object({});
export const LibraryRuleSchema = Type.Object({
  "action": Type.String(),
  "os"    : Type.Optional(Type.Object({
    "name": Type.String(),
  })),
});

export const LibrarySchema = Type.Intersect([
  Type.Object({
    "name": Type.String(),
  }),
  Type.Partial(
    Type.Object({
      "downloads": LibraryDownloadsSchema,
      "extract"  : LibraryExtractSchema,
      "natives"  : LibraryNativesSchema,
      "rules"    : Type.Array(
        LibraryRuleSchema,
      ),
      "url"     : Type.String(),
      "MMC-hint": Type.String(),
    }),
  ),
]);
