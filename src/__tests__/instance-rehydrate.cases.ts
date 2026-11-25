import { expect, spyOn, test } from "bun:test";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { instanceStates, restorePlaytime } from "@/states/instance.ts";
import { activeRun } from "@/states/instance-operation.ts";

import {
  exit, id, listProcesses, mountProvider, nativeKill, noop,
  useInstanceContextHarness,
} from "./instance-context-harness.ts";

useInstanceContextHarness();

test.each(["helper first", "selected first", "selected missing"])("restore %s", async order => {
  spyOn(Date, "now").mockReturnValue(1000);
  spyOn(performance, "now").mockReturnValue(100);
  const instanceId = order;
  const selected = {
    "token": "selected-" + instanceId, "pid": 4, "kind": "minecraft", "meta": { instanceId },
  };
  const helper = { ...selected, "token": "helper-" + instanceId, "pid": 5 };
  const key = "kaede.playtime::active." + instanceId;
  const checkpoint = JSON.stringify({
    "token"       : selected.token, "savedAt"     : Date.now(),
    "carriedMs"   : 100, "basePlayTime": 0, "lastLaunch"  : 1,
  });

  Object.assign(globalThis, { "localStorage": {
    "length": 1, "key": () => key, "getItem": () => checkpoint, "setItem": noop,
  } });
  try {
    instanceStates[instanceId] = { ...instanceStates[id], "playTime": 0 };
    restorePlaytime();
    const processes = order === "helper first" ? [helper, selected] : [selected, helper];

    listProcesses.mockReturnValueOnce(order === "selected missing" ? [helper] : processes);
    await mountProvider();
    const { closeInstance, launchInstance } = GlobalInternals.instanceContext!;

    await Bun.sleep(0);
    const missing = order === "selected missing";

    expect(activeRun(instanceId)?.process.token).toBe(missing ? undefined : selected.token);
    if (missing) {
      nativeKill.mockClear();
      await closeInstance(instanceId);
      expect(nativeKill).not.toHaveBeenCalled();
      expect(instanceStates[instanceId].playTime).toBe(100);
    }
    await launchInstance(instanceId);
    const run = activeRun(instanceId)!;

    expect(run.process.token).not.toBe(helper.token);
    exit(helper.token);
    expect(activeRun(instanceId)).toBe(run);
    exit(run.process.token);
    if (missing) expect(instanceStates[instanceId].playTime).toBe(100);
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});
