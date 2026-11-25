import { expect, spyOn, test } from "bun:test";

import Configs from "@/lib/configs";
import type { AccountType } from "@/types/configs/account.type.ts";

import * as refresh from "./ensure-fresh-account.ts";
import { resolveAccountAtIndex } from "./resolve-launch-account.ts";

test("refresh merges by UUID against the latest persisted accounts", async () => {
  const first = { "profile": { "uuid": "a" }, "msa": null } as AccountType;
  const second = { "profile": { "uuid": "b" }, "msa": null } as AccountType;
  const added = { "profile": { "uuid": "c" }, "msa": null } as AccountType;
  const refreshed = { ...second, "profile": { ...second.profile, "name": "updated" } };

  using fresh = spyOn(refresh, "ensureFreshAccount").mockResolvedValue({
    "account": refreshed, "status": "refreshed",
  });
  using latest = spyOn(Configs, "getAccounts").mockResolvedValue([added, second, first]);
  using write = spyOn(Configs, "writeAccounts").mockResolvedValue(true);

  const result = await resolveAccountAtIndex([first, second], 1);

  expect(fresh).toHaveBeenCalledWith(second);
  expect(result?.accounts).toEqual([added, refreshed, first]);
  expect(write).toHaveBeenCalledWith({ "accounts": [added, refreshed, first] });

  latest.mockResolvedValue([added, first]);
  expect(await resolveAccountAtIndex([first, second], 1)).toBeUndefined();
  expect(write).toHaveBeenCalledTimes(1);
});

test("concurrent refreshes preserve both updates and recover from a failed write", async () => {
  const original = ["a", "b"].map(uuid => ({
    "profile": { uuid, "name": "old" }, "msa": null,
  } as AccountType));
  let stored = [...original];

  using fresh = spyOn(refresh, "ensureFreshAccount").mockImplementation(async account => ({
    "status" : "refreshed",
    "account": { ...account, "profile": { ...account.profile, "name": "new" } },
  }));
  using read = spyOn(Configs, "getAccounts").mockImplementation(async () => [...stored]);
  using write = spyOn(Configs, "writeAccounts").mockImplementation(async ({ accounts }) => {
    stored = [...accounts];

    return true;
  });

  write.mockResolvedValueOnce(false);
  await expect(resolveAccountAtIndex(original, 0)).rejects.toThrow("Failed to save");
  await Promise.all(original.map((_, index) => resolveAccountAtIndex(original, index)));

  expect(stored.map(({ profile }) => profile.name)).toEqual(["new", "new"]);
  expect(fresh).toHaveBeenCalledTimes(3);
  expect(read).toHaveBeenCalledTimes(3);
});
