import { expect, spyOn, test } from "bun:test";

import Configs from "@/lib/configs";
import * as reads from "@/lib/configs/scopes/get-accounts.ts";
import * as file from "@/lib/file-manager/publish-text.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

import * as refresh from "./ensure-fresh-account.ts";
import { resolveAccountAtIndex } from "./resolve-launch-account.ts";

function profile(uuid: string): AccountType {
  return {
    "profile": { uuid, "type": "offline", "name": "old" },
    "msa"    : null,
    "skin"   : { "variant": "classic", "id": "", "url": "", "data": "" },
  };
}

test("refresh merges by UUID against the latest persisted accounts", async () => {
  const first = profile("a");
  const second = profile("b");
  const added = profile("c");
  const refreshed = { ...second, "profile": { ...second.profile, "name": "updated" } };

  using fresh = spyOn(refresh, "ensureFreshAccount").mockResolvedValue({
    "account": refreshed, "status": "refreshed",
  });
  using latest = spyOn(reads, "getAccounts").mockResolvedValue([added, second, first]);
  using write = spyOn(file, "publishText").mockResolvedValue();

  const result = await resolveAccountAtIndex([first, second], 1);

  expect(fresh).toHaveBeenCalledWith(second);
  expect(result?.accounts).toEqual([added, refreshed, first]);
  expect(JSON.parse(write.mock.calls[0][1])).toEqual([added, refreshed, first]);

  latest.mockResolvedValue([added, first]);
  expect(await resolveAccountAtIndex([first, second], 1)).toBeUndefined();
  expect(write).toHaveBeenCalledTimes(1);
});

test("concurrent refreshes preserve both updates and recover from a failed write", async () => {
  const original = ["a", "b", "removed"].map(uuid => profile(uuid));
  let stored = [...original];

  using fresh = spyOn(refresh, "ensureFreshAccount").mockImplementation(async account => ({
    "status" : "refreshed",
    "account": { ...account, "profile": { ...account.profile, "name": "new" } },
  }));
  using read = spyOn(reads, "getAccounts").mockImplementation(async () => [...stored]);
  using write = spyOn(file, "publishText").mockImplementation(async (_, data) => {
    stored = JSON.parse(data);
  });

  write.mockRejectedValueOnce(new Error("write failed"));
  await expect(resolveAccountAtIndex(original, 0)).rejects.toThrow("Failed to save");
  await Promise.all([
    resolveAccountAtIndex(original, 0),
    Configs.updateAccounts(current => [...current, profile("added")]),
    resolveAccountAtIndex(original, 1),
    Configs.updateAccounts(current => current.filter(entry => entry.profile.uuid !== "removed")),
  ]);

  expect(stored.map(({ profile }) => [profile.uuid, profile.name]))
    .toEqual([["a", "new"], ["b", "new"], ["added", "old"]]);
  expect(fresh).toHaveBeenCalledTimes(3);
  expect(read).toHaveBeenCalledTimes(5);
});
