import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { AccountType } from "@/types/configs/account.type.ts";

export async function getAccounts(baseDirectory: string): Promise<Array<AccountType>> {
  const parsedAccounts: unknown = await General.handleJsonFile({
    baseDirectory,
    "path"           : [FileStructure.Files.Accounts],
    "label"          : "accounts",
    "getDefaultValue": async () => ([]),
  });

  log.debug("Validating the parsed accounts file");

  if (!Array.isArray(parsedAccounts)) {
    log.info("The provided accounts data is not array-like");

    return [];
  }

  const validAccounts: Array<AccountType> = [];

  for (const entry of parsedAccounts) {
    const valid: boolean = Schemas.AccountValidator.Check(entry);

    if (!valid) {
      log.warn("The provided");

      continue;
    }

    validAccounts.push(entry);
  }

  return validAccounts;
}
