import { getConfigFile } from "@/lib/configs/scopes/get-config-file.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { getSafeConfigFile } from "@/lib/configs/scopes/get-safe-config-file.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";

export default {
  "get"       : getConfigFile,
  "getDefault": getDefaultConfig,
  "getSafe"   : getSafeConfigFile,
  "initialize": initializeConfigFile,
} as const;
