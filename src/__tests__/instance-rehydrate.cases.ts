import { expect, spyOn, test } from "bun:test";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getHooks } from "@/extendable/hooks-registry.ts";
import { spawnProcess } from "@/lib/processes/spawn-process.ts";
import { flushPlaytime, instanceStates, restorePlaytime } from "@/states/instance.ts";
import { activeRun } from "@/states/instance-operation.ts";

import {
  exit, id, listProcesses, mountProvider, nativeKill,
  useInstanceContextHarness,
} from "./instance-context-harness.ts";

useInstanceContextHarness();

function installStorage(saved: Map<string, string>): void {
  Object.assign(globalThis, { "localStorage": {
    get "length"() {
      return saved.size;
    },
    "key"       : (index: number) => [...saved.keys()][index],
    "getItem"   : (key: string) => saved.get(key) ?? null,
    "setItem"   : (key: string, value: string) => saved.set(key, value),
    "removeItem": (key: string) => saved.delete(key),
  } });
}


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

  const saved = new Map([[key, checkpoint]]);

  installStorage(saved);
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
    exit(run.process.token);
    await flushPlaytime(async () => {});
    const credited = instanceStates[instanceId].playTime;

    restorePlaytime();
    listProcesses.mockReturnValueOnce([helper]);
    await mountProvider();
    const next = GlobalInternals.instanceContext!;

    await next.closeInstance(instanceId);
    expect(activeRun(instanceId)).toBeUndefined();
    expect(instanceStates[instanceId].playTime).toBe(credited);
    await next.launchInstance(instanceId);
    const relaunched = activeRun(instanceId)!;

    exit(helper.token);
    expect(activeRun(instanceId)).toBe(relaunched);
    exit(relaunched.process.token);
    listProcesses.mockReturnValueOnce([]);
    await mountProvider();
    await Bun.sleep(0);
    expect([...saved.keys()].some(key => key.endsWith(helper.token))).toBe(false);
    if (missing) expect(instanceStates[instanceId].playTime).toBe(100);
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test.each(["before", "after"])("restore with a sibling spawned %s adoption", async when => {
  const saved = new Map<string, string>;
  const instanceId = "new launch " + when;
  const spec = {
    "program": { "type": "path", "value": "java" },
    "kind"   : "minecraft", "meta"   : { instanceId },
  } as const;

  installStorage(saved);
  try {
    instanceStates[instanceId] = { ...instanceStates[id], "playTime": 0 };
    await mountProvider();
    let helper!: Awaited<ReturnType<typeof spawnProcess>>;

    if (when === "before") helper = await spawnProcess(spec);
    else getHooks().onMinecraftLaunch.after.push(async () => {
      helper = await spawnProcess(spec);
    });

    await GlobalInternals.instanceContext!.launchInstance(instanceId);
    const selected = activeRun(instanceId)!;

    expect([...saved.keys()].some(key => key.endsWith(helper.token))).toBe(true);
    exit(selected.process.token);
    await flushPlaytime(async () => {});
    for (let reload = 0; reload < 2; reload++) {
      restorePlaytime();
      listProcesses.mockReturnValueOnce([helper]);
      await mountProvider();
      await Bun.sleep(0);
      expect(activeRun(instanceId)).toBeUndefined();
    }
    const legacy = { ...helper, "token": "legacy", "pid": 30 };

    listProcesses.mockReturnValueOnce([legacy]);
    await mountProvider();
    await Bun.sleep(0);
    expect(activeRun(instanceId)?.process.token).toBe(legacy.token);
    expect([...saved.keys()].some(key => key.endsWith(helper.token))).toBe(false);
    exit(legacy.token);
    exit(helper.token);
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});
