import { type } from "arktype";

export const ArtifactSchema = type({
  "path" : "string > 0",
  "sha1" : "string.hex == 40",
  "size" : "number > 0",
  "url"  : "string.url",
});
export type Artifact = typeof ArtifactSchema.infer;

export const ClassifiersSchema = type({
  "natives-linux?"   : ArtifactSchema,
  "natives-osx?"     : ArtifactSchema,
  "natives-windows?" : ArtifactSchema,
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
    "artifact"     : ArtifactSchema,
    "classifiers?" : ClassifiersSchema,
  },
  "name"     : "string",
  "rules?"   : RulesSchema.array(),
  "extract?" : type({ "exclude": "string[]" }),
  "natives?" : "'linux' | 'windows' | 'osx'",
});
export const LibrariesSchema = type(LibrarySchema.array());
export type Library = typeof LibrarySchema.infer;
export type Libraries = typeof LibrariesSchema.infer;
