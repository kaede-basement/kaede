import { Type } from "typebox";

import { MinecraftSchema } from "@/lib/schemas/scopes/config/minecraft.schema.ts";
import { PatchUidSchema } from "@/lib/schemas/scopes/meta/patch-uid.schema.ts";

export const InstanceMetadataSchema = Type.Intersect([
  MinecraftSchema,
  Type.Object({
    "name"         : Type.String(),
    "checksum"     : Type.Boolean(),
    "playTime"     : Type.Number(),
    // Initially used 'PatchUidSchema', but custom patches were not possible because of this
    "entry"        : Type.String(),
    "patchVersions": Type.Intersect([
      Type.Record(
        Type.Literal("net.minecraft"),
        Type.String(),
      ),
      Type.Partial(
        Type.Record(
          PatchUidSchema,
          Type.String(),
        ),
      ),
    ]),
  }),
]);
