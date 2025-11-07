import Type, { type Static } from "typebox";
import { Compile } from "typebox/compile";

const VersionManifestSchema = Type.Object({
  "latest": Type.Object({
    "release" : Type.String(),
    "snapshot": Type.String(),
  }),
  "versions": Type.Array(
    Type.Object({
      "id"  : Type.String(),
      "type": Type.Union([
        Type.Literal("release"),
        Type.Literal("snapshot"),
        Type.Literal("old-beta"),
        Type.Literal("old-alpha"),
      ]),
      "url"        : Type.String({ "format": "url" }),
      "time"       : Type.String({ "format": "date-time" }),
      "releaseTime": Type.String({ "format": "date-time" }),
    }),
  ),
});

export const VersionManifestValidator = Compile(VersionManifestSchema);
export type VersionManifestType = Static<typeof VersionManifestSchema>;