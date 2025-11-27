import { Compile } from "typebox/compile";

import { AssetsSchema } from "@/lib/schemas/scopes/assets.schema.ts";
import { ConfigSchema } from "@/lib/schemas/scopes/config.schema.ts";
import { ExtensionMetadataSchema } from "@/lib/schemas/scopes/extension-metadata.schema.ts";

const AssetsValidator = Compile(AssetsSchema);
const ConfigValidator = Compile(ConfigSchema);
const ExtensionMetadataValidator = Compile(ExtensionMetadataSchema);

export default {
  AssetsValidator,
  ConfigValidator,
  ExtensionMetadataValidator,
} as const;