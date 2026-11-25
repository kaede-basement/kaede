import { hashKey } from "@tanstack/vue-query";

import { updateAccounts } from "@/lib/configs/scopes/write-accounts.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

type RefreshSnapshot = { "uuid": string; "key": string };

export function snapshotAccount(account: AccountType): RefreshSnapshot {
  return { "uuid": account.profile.uuid, "key": hashKey([account]) };
}

export async function commitAccountRefresh(
  snapshot: RefreshSnapshot, refreshed?: AccountType, signal?: AbortSignal,
): Promise<{ "accounts": Array<AccountType>; "account": AccountType | undefined }> {
  const { uuid, key } = snapshot;

  if (refreshed && refreshed.profile.uuid !== uuid) {
    throw new Error("The refreshed account does not match the selected profile");
  }
  const accounts = await updateAccounts(current => {
    if (!refreshed || signal?.aborted) return;
    const index = current.findIndex(entry => entry.profile.uuid === uuid);

    if (index === -1 || hashKey([current[index]]) !== key) return;
    const next = [...current];

    next[index] = refreshed;

    return next;
  });

  return { accounts, "account": accounts.find(entry => entry.profile.uuid === uuid) };
}
