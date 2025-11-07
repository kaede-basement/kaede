import Type, { type Static } from "typebox";
import { Compile } from "typebox/compile";

export const ArtifactSchema = Type.Object({
  "path": Type.String(),
  "sha1": Type.String(),
  "size": Type.Number(),
  "url" : Type.String(),
});
export type Artifact = Static<typeof ArtifactSchema>;

export const ClassifiersSchema = Type.Object({
  "natives-windows": Type.Optional(ArtifactSchema),
  "natives-linux"  : Type.Optional(ArtifactSchema),
  "natives-osx"    : Type.Optional(ArtifactSchema),
});
export type Classifiers = Static<typeof ClassifiersSchema>;

export const DownloadSchema = Type.Object({
  "artifact"   : ArtifactSchema,
  "classifiers": Type.Optional(ClassifiersSchema),
});

export const AssetIndexSchema = Type.Object({
  "id"       : Type.String(),
  "sha1"     : Type.String(),
  "size"     : Type.Number(),
  "totalSize": Type.Number(),
  "url"      : Type.String(),
});
export type AssetIndex = Static<typeof AssetIndexSchema>;
export const AssetIndexValidator = Compile(AssetIndexSchema);

export const AssetSchema = Type.Object({
  "hash": Type.String(),
  "size": Type.Number(),
});
export type Asset = Static<typeof AssetSchema>;

export const AssetsSchema = Type.Object({
  "objects": Type.Array(AssetSchema),
});
export type Assets = Static<typeof AssetsSchema>;
export const AssetsValidator = Compile(AssetsSchema);

export const LoggingConfigSchema = Type.Object({
  "id"  : Type.String(),
  "sha1": Type.String(),
  "size": Type.Number(),
  "url" : Type.String(),
});
export type LoggingConfig = Static<typeof LoggingConfigSchema>;

export const LoggingSchema = Type.Object({
  "client": Type.Object({
    "argument": Type.String(),
    "file"    : LoggingConfigSchema,
    "type"    : Type.String(),
  }),
});

export const JavaVersionSchema = Type.Object({
  "component"   : Type.String(),
  "majorVersion": Type.Number(),
});