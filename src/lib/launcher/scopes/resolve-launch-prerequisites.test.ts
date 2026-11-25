import "@/extendable/global-object.ts";

import { expect, spyOn, test } from "bun:test";
import { shallowRef } from "vue";

import * as resolution from "@/lib/auth/scopes/resolve-launch-account.ts";
import Launcher from "@/lib/launcher";
import type { AccountType } from "@/types/configs/account.type.ts";

import { resolveLaunchPrerequisites } from "./resolve-launch-prerequisites.ts";

const first: AccountType = {
  "profile": { "uuid": "a", "name": "first", "type": "offline" },
  "msa"    : null, "skin"   : { "id": "", "data": "", "url": "", "variant": "classic" },
};

test("profile changes during the Java probe survive a committed refresh", async () => {
  const second = { ...first, "profile": { ...first.profile, "uuid": "b" } };
  const refreshed = { ...first, "profile": { ...first.profile, "name": "refreshed" } };
  const accounts = shallowRef([first]);
  const probe = Promise.withResolvers<number>();
  const refresh = Promise.withResolvers<void>();

  using java = spyOn(Launcher, "fetchJavaMajor").mockReturnValue(probe.promise);
  using auth = spyOn(resolution, "resolveLaunchAccountOutcome").mockImplementation(async () => {
    await refresh.promise;

    return { "status": "ready", "account": refreshed, "accounts": [refreshed] };
  });
  const launch = resolveLaunchPrerequisites(accounts, "java", (new AbortController).signal);

  accounts.value = [...accounts.value, second];
  refresh.resolve();
  await Bun.sleep(0);
  expect(accounts.value).toEqual([refreshed, second]);
  accounts.value = [second];
  probe.resolve(17);
  await launch;
  expect(accounts.value).toEqual([second]);
  expect(java).toHaveBeenCalledTimes(1);
  expect(auth).toHaveBeenCalledTimes(1);
});
