import Type, { type Static } from "typebox";

export const VersionManifest = Type.Object({
  "latest": Type.Object({
    "release" : Type.String(),
    "snapshot": Type.String(),
  }),
  "versions": Type.Array(
    Type.Object({
      "id"         : Type.String(),
      "type"       : Type.Union(["release, snapshot, old-beta, old-alpha"]),
      "url"        : Type.String({ "format": "url" }),
      "time"       : Type.String({ "format": "date-time" }),
      "releaseTime": Type.String({ "format": "date-time" }),
    }),
  ),
});
export type Manifest = Static<typeof VersionManifest>;

export const RuleSchema = Type.Object({
  "action": Type.Union(["allow", "disallow"]),
  "os"    : Type.Optional(
    Type.Object({
      "name": Type.String(),
    }),
  ),
});

export const ValueSchema = Type.Union([
  Type.String(),
  Type.Array(Type.String()),
]);

export const ArgumentSchema = Type.Union([
  Type.String(),
  Type.Object({
    "rules": Type.Array(RuleSchema),
    "value": ValueSchema,
  }),
]);

export const ArgumentsSchema = Type.Object({
  "game": Type.Array(ArgumentSchema),
  "jvm" : Type.Array(ArgumentSchema),
});

export const ArtifactSchema = Type.Object({
  "path": Type.String(),
  "sha1": Type.String(),
  "size": Type.Number(),
  "url" : Type.String(),
});
export type Artifact = Static<typeof ArtifactSchema>;

export const DownloadSchema = Type.Object({
  "artifact"   : ArtifactSchema,
  "classifiers": Type.Optional(
    Type.Record(Type.String(), ArtifactSchema),
  ),
});

export const LibrarySchema = Type.Object({
  "name"     : Type.String(),
  "downloads": DownloadSchema,
  "rules"    : Type.Optional(Type.Array(RuleSchema)),
});

export const AssetIndexSchema = Type.Object({
  "id"       : Type.String(),
  "sha1"     : Type.String(),
  "size"     : Type.Number(),
  "totalSize": Type.Number(),
  "url"      : Type.String(),
});
export type AssetIndex = Static<typeof AssetIndexSchema>;

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

export const VersionMetaModernSchema = Type.Object({
  "id"       : Type.String(),
  "type"     : Type.String(),
  "mainClass": Type.String(),
  "arguments": ArgumentsSchema,
  "libraries": Type.Array(LibrarySchema),
  "downloads": Type.Object({
    "client": ArtifactSchema,
    "server": Type.Optional(ArtifactSchema),
  }),
  "assetIndex" : AssetIndexSchema,
  "assets"     : Type.String(),
  "javaVersion": JavaVersionSchema,
  "logging"    : LoggingSchema,
});
export type VersionMetaModern = Static<typeof VersionMetaModernSchema>;