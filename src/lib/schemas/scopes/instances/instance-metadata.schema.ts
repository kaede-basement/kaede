import { Type } from "typebox";

import { MinecraftSchema } from "@/lib/schemas/scopes/config/minecraft.schema.ts";

export const InstanceMetadataSchema = Type.Union([
  MinecraftSchema,
  Type.Object({
    "id"      : Type.String(),
    "name"    : Type.String(),
    "version" : Type.String(),
    "launched": Type.Boolean(),
  }),
]);
