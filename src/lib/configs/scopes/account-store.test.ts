import { expect, spyOn, test } from "bun:test";

import { mockSaveAccounts } from "@/__mocks__/save-accounts.ts";
import FileManager from "@/lib/file-manager";
import type { AccountType } from "@/types/configs/account.type.ts";

import * as store from "./account-store.ts";
import { getAccounts } from "./get-accounts.ts";
import { updateAccounts, writeAccounts } from "./write-accounts.ts";

const account: AccountType = {
  "profile": { "uuid": "id", "type": "offline", "name": "player" },
  "msa"    : null, "skin"   : { "variant": "classic", "id": "", "url": "", "data": "" },
};

test("account mutations parse a BOM while retaining the original CAS snapshot", async () => {
  const raw = "\uFEFF" + JSON.stringify([account]);

  using read = spyOn(store, "readAccountText").mockResolvedValue(raw);
  using write = mockSaveAccounts().mockResolvedValue();
  expect(await getAccounts()).toEqual([account]);
  const remaining = await updateAccounts(current => (
    current.filter(entry => entry.profile.uuid !== "id")
  ));

  expect(remaining).toEqual([]);
  expect(write.mock.calls[0][0].expectedPrevious).toBe(raw);
  read.mockResolvedValue("\uFEFF{broken");
  await expect(updateAccounts(() => [])).rejects.toThrow();
  expect(write).toHaveBeenCalledTimes(1);
  await getAccounts({ "parsedFile": { "status": "loaded", "data": [] } });
});

test("alternate account directories cannot clear or set the active storage error", async () => {
  using active = spyOn(FileManager, "getBaseDirectory").mockReturnValue("active");
  let alternate = "[]";

  using read = spyOn(store, "readAccountText").mockImplementation(async directory => (
    directory === "alternate" ? alternate : "{broken"
  ));
  using write = mockSaveAccounts().mockResolvedValue();
  await getAccounts();
  expect(store.accountStoreError.value).toBe(true);
  const baseDirectory = "alternate";

  await getAccounts({ baseDirectory });
  expect(await writeAccounts({ baseDirectory, "accounts": [account] })).toBe(true);
  expect(store.accountStoreError.value).toBe(true);
  await getAccounts({ "parsedFile": { "status": "loaded", "data": [account] } });
  alternate = "{broken";
  await getAccounts({ baseDirectory });
  expect(await writeAccounts({ baseDirectory, "accounts": [] })).toBe(false);
  expect(store.accountStoreError.value).toBe(false);
  expect(write).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith(baseDirectory);
  expect(active).toHaveBeenCalled();
});
