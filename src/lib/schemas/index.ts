import { Compile } from "typebox/compile";

import { AccountSchema } from "@/lib/schemas/scopes/accounts/account.schema.ts";
import { AssetsSchema } from "@/lib/schemas/scopes/assets.schema.ts";
import { ConfigSchema } from "@/lib/schemas/scopes/config.schema.ts";
import { ExtensionMetadataSchema } from "@/lib/schemas/scopes/extension-metadata.schema.ts";
import { InstanceMetadataSchema } from "@/lib/schemas/scopes/instances/instance-metadata.schema.ts";
import { MinecraftVersionSchema } from "@/lib/schemas/scopes/meta/minecraft-version.schema.ts";

const AccountValidator = Compile(AccountSchema);
const AssetsValidator = Compile(AssetsSchema);
const ConfigValidator = Compile(ConfigSchema);
const InstanceMetadataValidator = Compile(InstanceMetadataSchema);
const ExtensionMetadataValidator = Compile(ExtensionMetadataSchema);

const MinecraftVersionValidator = Compile(MinecraftVersionSchema);

export default {
  AccountValidator,
  AssetsValidator,
  ConfigValidator,
  InstanceMetadataValidator,
  ExtensionMetadataValidator,
  MinecraftVersionValidator,
} as const;
