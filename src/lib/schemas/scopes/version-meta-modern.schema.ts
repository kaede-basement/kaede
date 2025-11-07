import Type, { type Static } from "typebox";
import { Compile } from "typebox/compile";

const VersionLibraryRuleSchema = Type.Object({
  "action": Type.Union([
    Type.Literal("allow"),
    Type.Literal("disallow"),
  ]),
  "os": Type.Optional(
    Type.Object({
      "name"   : Type.String(),
      "arch"   : Type.String(),
      "version": Type.String(),
    }),
  ),
});
const VersionArgumentSchema = Type.Union([
  Type.String(),
  Type.Object({
    "rules": Type.Array(VersionLibraryRuleSchema),
    "value": Type.Union([
      Type.String(),
      Type.Array(Type.String()),
    ]),
  }),
]);

export const VersionLibrarySchema = Type.Object({
  "name"     : Type.String(),
  "downloads": DownloadSchema,
  "rules"    : Type.Optional(Type.Array(VersionLibraryRuleSchema)),
  "extract"  : Type.Optional(Type.Object({
    "exclude": Type.Any(),
  })),
});
export const VersionMetaModernSchema = Type.Object({
  "id"       : Type.String(),
  "type"     : Type.String(),
  "mainClass": Type.String(),
  "arguments": Type.Object({
    "game": Type.Array(VersionArgumentSchema),
    "jvm" : Type.Array(VersionArgumentSchema),
  }),
  "libraries": Type.Array(VersionLibrarySchema),
  "downloads": Type.Object({
    "client": ArtifactSchema,
    "server": Type.Optional(ArtifactSchema),
  }),
  "assetIndex" : AssetIndexSchema,
  "assets"     : Type.String(),
  "javaVersion": JavaVersionSchema,
  "logging"    : LoggingSchema,
});

export type VersionMetaModernType = Static<typeof VersionMetaModernSchema>;
export type VersionLibraryType = Static<typeof VersionLibrarySchema>;

export const VersionMetaModernValidator = Compile(VersionMetaModernSchema);
export const VersionLibraryValidator = Compile(VersionLibrarySchema);