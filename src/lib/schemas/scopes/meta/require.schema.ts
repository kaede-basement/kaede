import { Type } from "typebox";

import { PatchUidSchema } from "@/lib/schemas/scopes/meta/patch-uid.schema.ts";

export const RequireSchema = Type.Object({
  "uid"   : PatchUidSchema,
  "equals": Type.Optional(
    Type.String(),
  ),
  "suggests": Type.Optional(
    Type.String(),
  ),
});
