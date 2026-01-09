import { Type } from "typebox";

import { MinecraftSchema } from "@/lib/schemas/scopes/config/minecraft.schema.ts";
import { PatchUidSchema } from "@/lib/schemas/scopes/meta/patch-uid.schema.ts";

export const InstanceMetadataSchema = Type.Intersect([
  MinecraftSchema,
  Type.Object({
    "name"    : Type.String(),
    "version" : Type.String(),
    "checksum": Type.Boolean(),
    "entry"   : PatchUidSchema,
  }),
]);
