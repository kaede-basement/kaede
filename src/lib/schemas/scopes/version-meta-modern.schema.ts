import Type, { type Static } from "typebox";
import { Compile } from "typebox/compile";

import { ArgumentSchema } from "@/lib/schemas/scopes/argument.schema.ts";
import { ArtifactSchema } from "@/lib/schemas/scopes/artifact.schema.ts";
import { AssetIndexSchema } from "@/lib/schemas/scopes/asset-index.schema.ts";
import { JavaVersionSchema } from "@/lib/schemas/scopes/java-version.schema.ts";
import { LibrarySchema } from "@/lib/schemas/scopes/library.schema.ts";
import { LoggingSchema } from "@/lib/schemas/scopes/logging.schema.ts";

export const VersionMetaModernSchema = Type.Object({
  "id"       : Type.String(),
  "type"     : Type.String(),
  "mainClass": Type.String(),
  "arguments": Type.Object({
    "game": Type.Array(ArgumentSchema),
    "jvm" : Type.Array(ArgumentSchema),
  }),
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

export type VersionMetaModernType = Static<typeof VersionMetaModernSchema>;
export const VersionMetaModernValidator = Compile(VersionMetaModernSchema);