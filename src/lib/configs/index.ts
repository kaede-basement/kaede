import { getConfigFile } from "@/lib/configs/scopes/get-config-file.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";

export default {
  "get"       : getConfigFile,
  "getDefault": getDefaultConfig,
  "initialize": initializeConfigFile,
} as const;