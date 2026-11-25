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

import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import { CheckAccount } from "@/lib/schemas/generated/validators.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

import {
  AccountConflict, accountStoreError, readAccountText, saveAccountText,
} from "./account-store.ts";

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
  return serializeWrite(async () => {
    try {
      const directory = input.baseDirectory ?? FileManager.getBaseDirectory();
      const { raw } = await readSnapshot(directory);

      await persistAccounts({ ...input, "baseDirectory": directory }, raw === undefined, raw);

      return true;
    } catch (error) {
      log.error(__PRE_BUNDLED_FILENAME__, "Failed to write accounts.json:", Errors.prettify(error));

      return false;
    }
  });
}

export async function persistAccounts(
  { accounts, baseDirectory }: AccountWrite, createNew = false, expectedPrevious?: string,
): Promise<void> {
  if (!accounts.every(entry => CheckAccount(entry))) {
    throw new Error("Invalid account data");
  }
  const directory = baseDirectory ?? FileManager.getBaseDirectory();

  await saveAccountText(directory, JSON.stringify(accounts, null, 2), createNew, expectedPrevious);
}

export function parseStoredAccounts(raw: string | undefined): unknown {
  return raw?.trim() ? JSON.parse(raw) : [];
}

async function readSnapshot(directory: string): Promise<{
  "raw": string | undefined; "current": Array<AccountType>;
}> {
  try {
    const raw = await readAccountText(directory);
    const current = parseStoredAccounts(raw);

    if (!Array.isArray(current) || !current.every(entry => CheckAccount(entry))) {
      throw new Error("Invalid account data in accounts.json");
    }

    accountStoreError.value = false;

    return { raw, current };
  } catch (error) {
    accountStoreError.value = true;
    throw error;
  }
}

export function updateAccounts(
  mutate: (current: ReadonlyArray<AccountType>) => Array<AccountType> | undefined,
): Promise<Array<AccountType>> {
  return serializeWrite(async () => {
    const baseDirectory = FileManager.getBaseDirectory();

    for (let attempt = 0; ; attempt++) {
      const { raw, current } = await readSnapshot(baseDirectory);
      const next = mutate(current);

      if (!next) return current;
      try {
        await persistAccounts({ baseDirectory, "accounts": next }, raw === undefined, raw);

        return next;
      } catch (error) {
        if (error !== AccountConflict || attempt > 0) {
          throw new Error("Failed to save the updated accounts");
        }
      }
    }
  });
}
