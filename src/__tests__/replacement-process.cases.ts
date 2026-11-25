import { expect, mock, spyOn, test } from "bun:test";
import { watch } from "vue";

import { LaunchStatus } from "@/constants/launcher.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getHooks } from "@/extendable/hooks-registry.ts";
import { spawnMinecraft } from "@/lib/launcher/scopes/spawn-minecraft.ts";
import { rehydrateProcesses, toProcessHandle } from "@/lib/processes/core.ts";
import { instanceStates } from "@/states/instance.ts";
import { activeRun } from "@/states/instance-operation.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";

import {
  exit, id, listProcesses, noop, useInstanceContextHarness,
} from "./instance-context-harness.ts";
import { launchHooks } from "./launch-extension-fixture.ts";

useInstanceContextHarness();

test.each(["before adoption", "after adoption"])("nested launcher exits %s", async order => {
  const { launchInstance, closeInstance } = GlobalInternals.instanceContext!;
  const { before } = getHooks().onMinecraftLaunch;
  const closed = mock(noop);
  const clock = spyOn(performance, "now").mockReturnValue(100);
  const initial = instanceStates[id].playTime;
  const credits: Array<number> = [];
  const killed = mock(async () => {
    credits.push(instanceStates[id].playTime);
  });
  const observed: Array<number> = [];
  const stopWatching = watch(
    () => GlobalInternals.instanceContext!.launches[id]?.current,
    status => {
      if (status === LaunchStatus.General.Aborted) observed.push(instanceStates[id].playTime);
    },
    { "flush": "sync" },
  );
  const idleCredits: Array<number> = [];
  const stopWatchingLaunch = watch(
    () => GlobalInternals.instanceContext!.launches[id]?.launching,
    launching => {
      if (launching === 0) idleCredits.push(instanceStates[id].playTime);
    },
    { "flush": "sync" },
  );
  const publicExit = mock(noop);
  let child!: MinecraftProcessType;

  getHooks().onMinecraftKill.after.push(killed);
  before.push(async options => {
    before.pop();
    const result = await spawnMinecraft({ ...options, "onClose": closed, "onInput": noop });

    if (!result.success || !result.process) throw new Error("nested launch failed");
    child = result.process;
    clock.mockReturnValue(500);
    if (order === "before adoption") {
      exit(child.token);
      await Bun.sleep(0);
    }

    return { "status": "stop", "response": { "success": true, "process": { ...child } } };
  });
  await launchInstance(id);
  if (order === "after adoption") {
    listProcesses.mockReturnValueOnce([child]);
    await rehydrateProcesses(() => ({ "onExit": publicExit }));
    const closing = closeInstance(id);

    await Bun.sleep(0);
    exit(child.token);
    await closing;
    expect(publicExit).toHaveBeenCalledTimes(1);
  }
  expect(activeRun(id)).toBeUndefined();
  expect(closed).toHaveBeenCalledTimes(1);
  stopWatching();
  stopWatchingLaunch();
  expect(killed).toHaveBeenCalledTimes(1);
  expect(credits).toEqual([initial + 400]);
  expect(observed).toEqual([initial + 400]);
  expect(idleCredits).toEqual([initial + 400]);
});

test.each([false, true])("published launch hook payloads (async %p)", async asynchronous => {
  const { launchInstance, closeInstance } = GlobalInternals.instanceContext!;
  const hooks = getHooks().onMinecraftLaunch;
  const process = toProcessHandle({
    "token": "fixture-" + asynchronous, "pid"  : 10, "kind" : "minecraft",
    "meta" : { "instanceId": id },
  });

  for (const response of ["continue", "veto", process] as const) {
    const received = mock(noop);
    const fixture = launchHooks(response, asynchronous, received);

    hooks.before.splice(0, hooks.before.length, ...fixture.before);
    hooks.after.splice(0, hooks.after.length, ...fixture.after);
    await launchInstance(id);
    expect(received).toHaveBeenCalledWith("java", [], id, id);
    if (response === "continue") {
      const child = activeRun(id)!.process;

      expect(received).toHaveBeenCalledWith("java", [], id, id, child.pid);
      exit(child.token);
    } else if (response === "veto") expect(activeRun(id)).toBeUndefined();
    else {
      expect(activeRun(id)?.process).toBe(process);
      await closeInstance(id);
    }
  }
});

test("distinct unmanaged PIDs sharing a token each settle once", async () => {
  const { closeInstance, launchInstance } = GlobalInternals.instanceContext!;
  const hooks = getHooks().onMinecraftLaunch;
  const clock = spyOn(performance, "now");
  const initial = instanceStates[id].playTime;
  const kill = mock(async () => {});
  const exited: Array<number> = [];

  getHooks().onMinecraftKill.after.push(async pid => {
    exited.push(pid);
  });
  for (const pid of [11, 12]) {
    const process = {
      ...toProcessHandle({
        "token": "shared", pid, "kind": "minecraft", "meta": { "instanceId": id },
      }),
      kill,
    };

    hooks.before.splice(0, hooks.before.length, () => ({
      "status": "stop", "response": { "success": true, process },
    }));
    clock.mockReturnValue(pid * 100);
    await launchInstance(id);
    expect(activeRun(id)?.process).toBe(process);
    clock.mockReturnValue((pid * 100) + 50);
    await closeInstance(id);
    await launchInstance(id);
    expect(activeRun(id)).toBeUndefined();
  }
  expect(kill).toHaveBeenCalledTimes(2);
  expect(exited).toEqual([11, 12]);
  expect(instanceStates[id].playTime).toBe(initial + 100);
});
