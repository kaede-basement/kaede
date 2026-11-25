/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { invoke } from "@tauri-apps/api/core";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import Browser from "@/lib/browser";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import Schemas from "@/lib/schemas";
import { CheckAccount } from "@/lib/schemas/generated/validators.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

let bridgeStorage = false;

export function useBridgeAccountStorage(): void {
  bridgeStorage = true;
}

let accountWriteChain: Promise<void> = Promise.resolve();

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = accountWriteChain.then(operation);

  accountWriteChain = result.then(() => {}, () => {});

  return result;
}

type AccountWrite = {
  "accounts"      : Array<AccountType>;
  "baseDirectory"?: string;
};

export function writeAccounts(input: AccountWrite): Promise<boolean> {
  return serializeWrite(() => persistAccounts(input));
}

export async function persistAccounts(
  { accounts, baseDirectory }: AccountWrite, createNew = false,
): Promise<boolean> {
  for (const [index, entry] of accounts.entries()) {
    const account: AccountType | false = Schemas.validate.account({
      "value": entry,
      "label": "account data (before writing)",
      "info" : {
        "id"   : entry?.profile?.name,
        "index": index,
      },
    });

    if (account === false) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        "Refusing to write the accounts file since an entry is not valid",
      );

      return false;
    }
  }

  try {
    const directory = baseDirectory ?? FileManager.getBaseDirectory();
    const contents = JSON.stringify(accounts, null, 2);

    if (bridgeStorage || Browser.detectIsBrowser()) {
      const path = FileManager.join(directory, FileStructure.Files.Accounts);

      if (createNew && await exists(path)) {
        return false;
      }
      await writeTextFile(path, contents, { createNew });
    } else if (await invoke<boolean>("save_accounts", {
      "baseDirectory": directory, contents, createNew,
    }) !== true) {
      return false;
    }
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to write the accounts file:",
      Errors.prettify(error),
    );

    return false;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Successfully wrote the accounts file");

  return true;
}

export function parseStoredAccounts(raw: string): unknown {
  return raw.trim() === "" ? [] : JSON.parse(raw);
}

async function readAccountsForUpdate(): Promise<Array<AccountType> | undefined> {
  const path = FileManager.join(FileManager.getBaseDirectory(), FileStructure.Files.Accounts);
  let raw: string;

  try {
    raw = await readTextFile(path);
  } catch (error) {
    if (!await exists(path)) {
      return;
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed = parseStoredAccounts(raw);
  } catch {
    throw new Error("Invalid JSON in accounts.json");
  }

  if (!Array.isArray(parsed) || !parsed.every(entry => CheckAccount(entry))) {
    throw new Error("Invalid account data in accounts.json");
  }

  return parsed;
}

export function updateAccounts(
  mutate: (current: ReadonlyArray<AccountType>) => Array<AccountType> | undefined,
): Promise<Array<AccountType>> {
  return serializeWrite(async () => {
    const current = await readAccountsForUpdate();
    const next = mutate(current ?? []);

    if (!next) {
      return current ?? [];
    }

    if (!await persistAccounts({ "accounts": next }, current === undefined)) {
      throw new Error("Failed to save the updated accounts");
    }

    return next;
  });
}
