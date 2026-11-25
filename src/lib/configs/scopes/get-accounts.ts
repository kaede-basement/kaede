import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { publishText } from "@/lib/file-manager/publish-text.ts";
import { log } from "@/lib/logging/log.ts";
import Schemas from "@/lib/schemas";
import type { ParsedFile } from "@/types/application/parsed-file.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

export async function getAccounts(properties?: Partial<{
  "baseDirectory": string;
  "parsedFile"   : ParsedFile;
}>): Promise<Array<AccountType>> {
  const baseDirectory: string = properties?.baseDirectory ?? FileManager.getBaseDirectory();
  const parsedFile: ParsedFile | undefined = properties?.parsedFile;

  const parsedAccounts: unknown = parsedFile?.status === "loaded"
    ? parsedFile.data
    : await FileManager.handleJsonFile({
      baseDirectory,
      "stateFile"      : "accounts",
      "corrupt"        : parsedFile?.status === "corrupt",
      "path"           : [FileStructure.Files.Accounts],
      "label"          : FileStructure.Files.Accounts,
      "getDefaultValue": async (): Promise<Array<unknown>> => ([]),
    });

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

  if (!Array.isArray(parsedAccounts) || validAccounts.length !== entries.length) {
    await publishText(FileManager.join(baseDirectory, FileStructure.Files.Accounts),
      JSON.stringify(validAccounts, null, 2),
      true,
      true,
      JSON.stringify(parsedAccounts));
  }

  return validAccounts;
}
