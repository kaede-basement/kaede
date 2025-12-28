import { Compile } from "typebox/compile";

import { AccountSchema } from "@/lib/schemas/scopes/accounts/account.schema.ts";
import { ConfigSchema } from "@/lib/schemas/scopes/config.schema.ts";
import { ExtensionMetadataSchema } from "@/lib/schemas/scopes/extension-metadata.schema.ts";
import { InstanceMetadataSchema } from "@/lib/schemas/scopes/instances/instance-metadata.schema.ts";
import { PatchMetaSchema } from "@/lib/schemas/scopes/meta/patch-meta.schema.ts";
import { validate } from "@/lib/schemas/scopes/validate.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { ValidationArgumentsType } from "@/types/schemas/validation-arguments.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

const AccountValidator = Compile(AccountSchema);
const ConfigValidator = Compile(ConfigSchema);
const InstanceMetadataValidator = Compile(InstanceMetadataSchema);
const ExtensionMetadataValidator = Compile(ExtensionMetadataSchema);

const PatchMetaValidator = Compile(PatchMetaSchema);

export default {

  /*
   * If there is additional unknown properties in object, validation will still pass,
   * which is actually good since extensions can use the same config file as the app
   */
  "validate": {
    "account": (data: ValidationArgumentsType) => validate<AccountType>({
      "value" : data.value,
      "info"  : data.info,
      "label" : data.label,
      "schema": AccountValidator,
    }),
    "config": (data: ValidationArgumentsType) => validate<ConfigType>({
      "value" : data.value,
      "info"  : data.info,
      "label" : data.label,
      "schema": ConfigValidator,
    }),
    "instance": (data: ValidationArgumentsType) => validate<InstanceStateType>({
      "value" : data.value,
      "info"  : data.info,
      "label" : data.label,
      "schema": InstanceMetadataValidator,
    }),
    "extension": (data: ValidationArgumentsType) => validate<ExtensionMetadataType>({
      "value" : data.value,
      "info"  : data.info,
      "label" : data.label,
      "schema": ExtensionMetadataValidator,
    }),
    "patchMeta": (data: ValidationArgumentsType) => validate<SpecificPatchMetaType>({
      "value" : data.value,
      "info"  : data.info,
      "label" : data.label,
      "schema": PatchMetaValidator,
    }),
  },
  AccountValidator,
  ConfigValidator,
  InstanceMetadataValidator,
  ExtensionMetadataValidator,
  PatchMetaValidator,
} as const;
