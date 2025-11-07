import Type from "typebox";

import { LibraryRuleSchema } from "@/lib/schemas/scopes/library-rule.schema.ts";

export const ArgumentSchema = Type.Union([
  Type.String(),
  Type.Object({
    "rules": Type.Array(LibraryRuleSchema),
    "value": Type.Union([
      Type.String(),
      Type.Array(Type.String()),
    ]),
  }),
]);