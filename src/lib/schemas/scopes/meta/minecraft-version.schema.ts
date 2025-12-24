import { Type } from "typebox";

import { AssetIndexSchema } from "@/lib/schemas/scopes/meta/asset-index.schema.ts";
import { LibrarySchema } from "@/lib/schemas/scopes/meta/library.schema.ts";
import { LoggingSchema } from "@/lib/schemas/scopes/meta/logging.schema.ts";
import { MainJarSchema } from "@/lib/schemas/scopes/meta/main-jar.schema.ts";
import { RequireSchema } from "@/lib/schemas/scopes/meta/require.schema.ts";

export const MinecraftVersionSchema = Type.Object({
  "+traits": Type.Array(
    Type.String(),
  ),
  "assetIndex"          : AssetIndexSchema,
  "compatibleJavaMajors": Type.Array(
    Type.Number(),
  ),
  "compatibleJavaName": Type.String(),
  "formatVersion"     : Type.Number(),
  "libraries"         : Type.Array(
    LibrarySchema,
  ),
  "logging"           : LoggingSchema,
  "mainClass"         : Type.String(),
  "mainJar"           : MainJarSchema,
  "minecraftArguments": Type.String(),
  "name"              : Type.String(),
  "order"             : Type.Number(),
  "releaseTime"       : Type.String(),
  "requires"          : Type.Array(
    RequireSchema,
  ),
  "type"   : Type.String(),
  "uid"    : Type.String(),
  "version": Type.String(),
});
