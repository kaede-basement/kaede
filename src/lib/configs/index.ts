import { getMain } from "@/lib/configs/get-main.ts";
import { getAccounts } from "@/lib/configs/scopes/get-accounts.ts";
import { ConfigReaders, getSafeConfigFile } from "@/lib/configs/scopes/get-safe-config-file.ts";
import { getTranslations } from "@/lib/configs/scopes/get-translations.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";
import { regenerateConfigFile } from "@/lib/configs/scopes/regenerate-config-file.ts";
import { updateAccounts, writeAccounts } from "@/lib/configs/scopes/write-accounts.ts";
import { sync } from "@/lib/configs/sync.ts";

export default Object.assign(ConfigReaders, {
  getMain,
  sync,

  "getSafe"   : getSafeConfigFile,
  "initialize": initializeConfigFile,
  "regenerate": regenerateConfigFile,
  getAccounts,
  getTranslations,
  writeAccounts,
  updateAccounts,
} as const);
