import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

export async function getAccounts(baseDirectory: string): Promise<Array<AccountType>> {
  const parsedAccounts: unknown = await General.handleJsonFile({
    baseDirectory,
    "path"        : [FileStructure.Files.Accounts],
    "label"       : "accounts",
    "defaultValue": [],
  });

  log.debug("Validating the parsed accounts file");

  if (!Array.isArray(parsedAccounts)) {
    log.info("The provided accounts data is not array-like");

    return [];
  }

  return;
}