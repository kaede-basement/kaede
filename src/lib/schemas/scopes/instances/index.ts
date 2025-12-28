import { Type } from "typebox";

import { MinecraftSchema } from "@/lib/schemas/scopes/config/minecraft.schema.ts";

export const InstanceMetadataSchema = Type.Intersect([
  MinecraftSchema,
  Type.Object({
    "name"   : Type.String(),
    "version": Type.String(),
  }),
]);
