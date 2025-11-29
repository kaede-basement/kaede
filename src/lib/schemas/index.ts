import { Compile } from "typebox/compile";

import { AssetsSchema } from "@/lib/schemas/scopes/assets.schema.ts";
import { ConfigSchema } from "@/lib/schemas/scopes/config.schema.ts";
import { ExtensionMetadataSchema } from "@/lib/schemas/scopes/extension-metadata.schema.ts";
import { InstanceMetadataSchema } from "@/lib/schemas/scopes/instances/instance-metadata.schema.ts";

const AssetsValidator = Compile(AssetsSchema);
const ConfigValidator = Compile(ConfigSchema);
const InstanceMetadataValidator = Compile(InstanceMetadataSchema);
const ExtensionMetadataValidator = Compile(ExtensionMetadataSchema);

export default {
  AssetsValidator,
  ConfigValidator,
  InstanceMetadataValidator,
  ExtensionMetadataValidator,
} as const;