import { exists, readTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import Schemas from "@/lib/schemas";
import type { ParsedFile } from "@/types/application/parsed-file.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

import { persistAccounts } from "./write-accounts.ts";

export async function getAccounts(properties?: Partial<{
  "baseDirectory": string;
  "parsedFile"   : ParsedFile;
}>): Promise<Array<AccountType>> {
  const baseDirectory: string = properties?.baseDirectory ?? FileManager.getBaseDirectory();
  const parsedFile: ParsedFile | undefined = properties?.parsedFile;

  const path = FileManager.join(baseDirectory, FileStructure.Files.Accounts);
  let parsedAccounts: unknown;

  try {
    if (parsedFile?.status === "corrupt") {
      log.error(__PRE_BUNDLED_FILENAME__, "Invalid JSON in accounts.json");

      return [];
    }
    if (parsedFile?.status === "loaded") {
      parsedAccounts = parsedFile.data;
    } else {
      const missing = parsedFile?.status === "missing" || !await exists(path);

      if (missing && await persistAccounts({ baseDirectory, "accounts": [] }, true)) {
        return [];
      }
      parsedAccounts = JSON.parse(await readTextFile(path));
    }
  } catch {
    log.error(__PRE_BUNDLED_FILENAME__, "Could not read accounts.json");

    return [];
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Validating the parsed accounts file");

  if (!Array.isArray(parsedAccounts)) {
    log.error(__PRE_BUNDLED_FILENAME__, "The provided accounts data is not array-like");

    return [];
  }

  const validAccounts: Array<AccountType> = [];

  for (const [index, entry] of parsedAccounts.entries()) {
    const account: AccountType | false = Schemas.validate.account({
      "value": entry,
      "label": "account data",
      "info" : {
        "id"   : entry?.profile?.name,
        "index": index,
      },
    });

    if (account !== false) {
      validAccounts.push(entry);
    }
  }

  return validAccounts;
}
