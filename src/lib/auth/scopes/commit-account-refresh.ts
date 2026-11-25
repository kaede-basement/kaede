import { hashKey } from "@tanstack/vue-query";

import { updateAccounts } from "@/lib/configs/scopes/write-accounts.ts";
import type { EnsureFreshResultType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

type RefreshSnapshot = { "uuid": string; "key": string; "credentials": string };

function credentialsKey(account: AccountType): string {
  return hashKey([account.profile.type, account.msa]);
}

export function snapshotAccount(account: AccountType): RefreshSnapshot {
  return {
    "uuid": account.profile.uuid, "key": hashKey([account]), "credentials": credentialsKey(account),
  };
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
    const stored = current[index];

    if (!stored || credentialsKey(stored) !== snapshot.credentials) return;
    const next = [...current];

    next[index] = hashKey([stored]) === key
      ? { ...stored, ...refreshed }
      : {
        ...stored, "msa"    : refreshed.msa,
        "profile": { ...stored.profile, "type": refreshed.profile.type },
      };

    return next;
  });

  const account = accounts.find(entry => entry.profile.uuid === uuid);

  if (!account) return { accounts, "status": "missing" };
  const failed = result.status === "failed" && credentialsKey(account) === snapshot.credentials;

  return { account, accounts, "status": failed ? "failed" : "ready" };
}
