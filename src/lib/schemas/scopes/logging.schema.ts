import Type from "typebox";

import { LoggingConfigSchema } from "@/lib/schemas/scopes/logging-config.schema.ts";

export const LoggingSchema = Type.Object({
  "client": Type.Object({
    "argument": Type.String(),
    "file"    : LoggingConfigSchema,
    "type"    : Type.String(),
  }),
});