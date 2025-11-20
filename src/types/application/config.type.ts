import type { Static } from "typebox";

import type { ConfigSchema } from "@/lib/schemas/scopes/config.schema.ts";

export type ConfigType = Static<typeof ConfigSchema>;