import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import { CheckAccount } from "@/lib/schemas/generated/validators.ts";
import type { ParsedAccountFile } from "@/types/application/parsed-file.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

import { AccountConflict, accountStoreError, readAccountText } from "./account-store.ts";
import { parseStoredAccounts, persistAccounts } from "./write-accounts.ts";

export async function getAccounts(properties?: Partial<{
  "baseDirectory": string;
  "parsedFile"   : ParsedAccountFile;
}>): Promise<Array<AccountType>> {
  const baseDirectory: string = properties?.baseDirectory ?? FileManager.getBaseDirectory();
  const parsedFile: ParsedAccountFile | undefined = properties?.parsedFile;

  try {
    let parsed: unknown;

    if (parsedFile?.status === "unreadable" || parsedFile?.status === "corrupt") {
      throw new Error("Could not read accounts.json");
    }
    if (parsedFile?.status === "loaded") {
      parsed = parsedFile.data;
    } else {
      let raw = await readAccountText(baseDirectory);

      if (raw === undefined) {
        try {
          await persistAccounts({ baseDirectory, "accounts": [] }, true);
        } catch (error) {
          if (error !== AccountConflict) throw error;
          raw = await readAccountText(baseDirectory);
        }
      }
      parsed = parseStoredAccounts(raw);
    }
    if (!Array.isArray(parsed)) throw new Error("Invalid account list");
    const accounts = parsed.filter(entry => CheckAccount(entry));

    accountStoreError.value = accounts.length !== parsed.length;

    return accounts;
  } catch {
    accountStoreError.value = true;
    log.error(__PRE_BUNDLED_FILENAME__, "Could not read accounts.json");

    return [];
  }
}
