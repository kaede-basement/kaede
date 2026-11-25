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
