import type { Static } from "typebox";

import type { ConfigSchema } from "@/lib/schemas/scopes/config";

export type ConfigType = Static<typeof ConfigSchema>;