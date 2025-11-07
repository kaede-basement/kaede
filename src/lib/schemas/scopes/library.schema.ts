import Type from "typebox";
import { Compile } from "typebox/compile";

import { DownloadSchema } from "@/lib/schemas/scopes/download.schema.ts";
import { LibraryRuleSchema } from "@/lib/schemas/scopes/library-rule.schema.ts";

export const LibrarySchema = Type.Object({
  "name"     : Type.String(),
  "downloads": DownloadSchema,
  "rules"    : Type.Optional(Type.Array(LibraryRuleSchema)),
  "extract"  : Type.Optional(Type.Object({
    "exclude": Type.Any(),
  })),
});
export const LibraryValidator = Compile(LibrarySchema);