import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { readState } from "@/lib/file-manager/read-state.ts";
import { log } from "@/lib/logging/log.ts";
import Schemas from "@/lib/schemas";
import type { ParsedFile } from "@/types/application/parsed-file.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

export async function getAccounts(properties?: Partial<{
  "baseDirectory": string;
  "parsedFile"   : ParsedFile;
}>): Promise<Array<AccountType>> {
  const baseDirectory: string = properties?.baseDirectory ?? FileManager.getBaseDirectory();

  const filename = FileStructure.Files.Accounts;

  return readState(baseDirectory, filename, properties?.parsedFile, () => [], true, validate);
}

function validate(parsedAccounts: unknown): { "value": Array<AccountType>; "valid": boolean } {
  log.debug(__PRE_BUNDLED_FILENAME__, "Validating the parsed accounts file");

  const entries = Array.isArray(parsedAccounts) ? parsedAccounts : [];
  const validAccounts: Array<AccountType> = [];

  for (const [index, entry] of entries.entries()) {
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

  const valid = Array.isArray(parsedAccounts) && validAccounts.length === entries.length;

  return { "value": validAccounts, valid };
}
