import { Compile } from "typebox/compile";

import { AssetsSchema } from "@/lib/schemas/scopes/assets.schema.ts";
import { ConfigSchema } from "@/lib/schemas/scopes/config.schema.ts";

const AssetsValidator = Compile(AssetsSchema);
const ConfigValidator = Compile(ConfigSchema);

export default {
  AssetsValidator,
  ConfigValidator,
} as const;