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

import { confirm } from "@tauri-apps/plugin-dialog";

import { buildLaunchAuth } from "@/lib/auth/scopes/build-launch-auth.ts";
import { ensureFreshAccount } from "@/lib/auth/scopes/ensure-fresh-account.ts";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import type { LaunchAuthType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

import { commitAccountRefresh, snapshotAccount } from "./commit-account-refresh.ts";

export type AccountResolution =
  | { "status": "ready"; "account": AccountType; "accounts": Array<AccountType> }
  | { "status": "missing" }
  | { "status": "cancelled" };

export async function resolveLaunchAccount(
  accounts: Array<AccountType>, signal?: AbortSignal,
): Promise<{ "auth": LaunchAuthType; "accounts": Array<AccountType> } | undefined> {
  const result = await resolveLaunchAccountOutcome(accounts, signal);

  if (result.status === "ready") {
    return { "auth": buildLaunchAuth(result.account), "accounts": result.accounts };
  }
}

export async function resolveLaunchAccountOutcome(
  accounts: Array<AccountType>, signal?: AbortSignal, selectedIndex = globalStates.selected.account,
): Promise<AccountResolution> {
  const activeAccount = accounts[selectedIndex];

  if (!activeAccount) {
    log.info(__PRE_BUNDLED_FILENAME__, "No accounts are present");

    return { "status": "missing" };
  }
  const snapshot = snapshotAccount(activeAccount);
  const { account, status } = await ensureFreshAccount(activeAccount);

  if (signal?.aborted) return { "status": "cancelled" };
  if (status === "failed") {
    const toContinue = await confirm(
      "An error happened while refreshing a token for the selected account." +
      "\nDo you want to continue launching Minecraft? " +
      "You won't be able to play on premium servers.",
      "Account refreshing",
    );

    if (!toContinue || signal?.aborted) return { "status": "cancelled" };
  }
  if (status !== "refreshed") {
    return { "status": "ready", account, accounts };
  }

  const committed = await commitAccountRefresh(snapshot, account, signal);

  if (signal?.aborted) return { "status": "cancelled" };
  if (!committed.account) return { "status": "missing" };

  return { "status": "ready", "account": committed.account, "accounts": committed.accounts };
}
