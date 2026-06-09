import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getAccounts } from "@/lib/configs/scopes/get-accounts.ts";
import { getCachedInitial } from "@/lib/configs/scopes/get-cached-initial.ts";
import { getConfigFile } from "@/lib/configs/scopes/get-config-file.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { getSafeConfigFile } from "@/lib/configs/scopes/get-safe-config-file.ts";
import { getTranslations } from "@/lib/configs/scopes/get-translations.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";
import { regenerateConfigFile } from "@/lib/configs/scopes/regenerate-config-file.ts";

export default {
  "get"       : getConfigFile,
  "getDefault": getDefaultConfig,
  "getSafe"   : getSafeConfigFile,
  "initialize": initializeConfigFile,
  "regenerate": regenerateConfigFile,
  "sync"      : (): Promise<void> => {
    return GlobalInternals.syncConfig();
  },
  getAccounts,
  getCachedInitial,
  getTranslations,
} as const;
