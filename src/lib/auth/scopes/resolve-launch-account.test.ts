import { expect, mock, test } from "bun:test";

import type { AccountType } from "@/types/configs/account.type.ts";

const first = { "profile": { "uuid": "a" }, "msa": null } as AccountType;
const second = { "profile": { "uuid": "b" }, "msa": null } as AccountType;
const refreshed = { ...second, "profile": { ...second.profile, "name": "updated" } };
const writeAccounts = mock(async () => true);

mock.module("@/states/global.ts", () => ({ "globalStates": { "selected": { "account": 1 } } }));
mock.module("@/lib/configs", () => ({ "default": { writeAccounts } }));
mock.module("./ensure-fresh-account.ts", () => ({
  "ensureFreshAccount": mock(async () => ({ "account": refreshed, "status": "refreshed" })),
}));

const { resolveLaunchAccount } = await import("./resolve-launch-account.ts");

test("refreshing the second profile preserves the first profile and account order", async () => {
  const accounts = [first, second];
  const result = await resolveLaunchAccount(accounts);

  expect(result?.accounts).toEqual([first, refreshed]);
  expect(accounts).toEqual([first, second]);
  expect(writeAccounts).toHaveBeenCalledWith({ "accounts": [first, refreshed] });
});
