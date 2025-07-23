import { type } from "arktype";

export const ArtifactSchema = type({
  "path" : "string > 0",
  "sha1" : "string.hex == 40",
  "size" : "number > 0",
  "url"  : "string.url",
});
export type Artifact = typeof ArtifactSchema.infer;

export const ClassifiersSchema = type({
  "natives-linux?"      : ArtifactSchema,
  "natives-linux-32?"   : ArtifactSchema,
  "natives-linux-64?"   : ArtifactSchema,
  "natives-osx?"        : ArtifactSchema,
  "natives-osx-32?"     : ArtifactSchema,
  "natives-osx-64?"     : ArtifactSchema,
  "natives-windows?"    : ArtifactSchema,
  "natives-windows-32?" : ArtifactSchema,
  "natives-windows-64?" : ArtifactSchema,
});
export type Classifier = typeof ClassifiersSchema.infer;

export const RulesSchema = type({
  "action" : "'allow' | 'disallow'",
  "os?"    : type({
    "name": "'osx' | 'windows' | 'linux'",
  }),
});
export type Rule = typeof RulesSchema.infer;

export const LibrarySchema = type({
  "downloads": {
    "artifact?"    : ArtifactSchema,
    "classifiers?" : ClassifiersSchema,
  },
  "name"     : "string",
  "rules?"   : RulesSchema.array(),
  "extract?" : type({ "exclude": "string[]" }),
  "natives?" : {
    "linux?"   : "string",
    "osx?"     : "string",
    "windows?" : "string",
  },
});
export type Library = typeof LibrarySchema.infer;

export const MinecraftVersionSchema = type({
  "assetIndex": {
    "id"        : "string",
    "sha1"      : "string.hex",
    "size"      : "number",
    "totalSize" : "number",
    "url"       : "string > 0",
  },
  "assets"          : "string",
  "complianceLevel" : "number",
  "downloads"       : {
    "client": {
      "sha1" : "string.hex",
      "size" : "number > 0",
      "url"  : "string",
    },
    // Optional because not used
    "server?": "object",
  },
  "id"          : "string",
  "javaVersion" : {
    "component"    : "string",
    "majorVersion" : "number",
  },
  "libraries" : LibrarySchema.array(),
  "logging"   : {
    "client": {
      "argument" : "string",
      "file"     : {
        "id"   : "string",
        "sha1" : "string",
        "size" : "number",
        "url"  : "string",
      },
      "type": "string",
    },
  },
  "mainClass"              : "string",
  "minecraftArguments"     : "string",
  "minimumLauncherVersion" : "number",
  "releaseTime"            : "string",
  "time"                   : "string",
  "type"                   : "string",
});

