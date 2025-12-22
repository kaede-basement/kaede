import { ApplicationNamespace } from "@/constants/application.ts";
import { getAccounts } from "@/lib/configs/scopes/get-accounts.ts";
import { getCachedInitial } from "@/lib/configs/scopes/get-cached-initial.ts";
import { getConfigFile } from "@/lib/configs/scopes/get-config-file.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { getSafeConfigFile } from "@/lib/configs/scopes/get-safe-config-file.ts";
import { getTranslations } from "@/lib/configs/scopes/get-translations.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";

export default {
  "get"       : getConfigFile,
  "getDefault": getDefaultConfig,
  "getSafe"   : getSafeConfigFile,
  "initialize": initializeConfigFile,
  "sync"      : async (): Promise<void> => {
    return window[ApplicationNamespace].__internals.syncConfig();
  },
  getAccounts,
  getCachedInitial,
  getTranslations,
} as const;
