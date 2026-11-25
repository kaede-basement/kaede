import { hashKey } from "@tanstack/vue-query";

import { updateAccounts } from "@/lib/configs/scopes/write-accounts.ts";
import type { EnsureFreshResultType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

type RefreshSnapshot = { "uuid": string; "key": string };

export function snapshotAccount(account: AccountType): RefreshSnapshot {
  return { "uuid": account.profile.uuid, "key": hashKey([account]) };
}

export async function commitAccountRefresh(
  snapshot: RefreshSnapshot, result: EnsureFreshResultType, signal?: AbortSignal,
): Promise<{
  "accounts": Array<AccountType>;
} & (
  | { "status": "missing" }
  | { "status": "ready" | "failed"; "account": AccountType }
)> {
  const { uuid, key } = snapshot;
  const refreshed = result.status === "refreshed" ? result.account : undefined;

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

  const account = accounts.find(entry => entry.profile.uuid === uuid);

  if (!account) return { accounts, "status": "missing" };
  const failed = result.status === "failed" && hashKey([account]) === key;

  return { account, accounts, "status": failed ? "failed" : "ready" };
}
