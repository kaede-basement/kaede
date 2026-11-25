import { expect, mock, test } from "bun:test";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getHooks } from "@/extendable/hooks-registry.ts";
import { spawnMinecraft } from "@/lib/launcher/scopes/spawn-minecraft.ts";
import { rehydrateProcesses, toProcessHandle } from "@/lib/processes/core.ts";
import { activeRun } from "@/states/instance-operation.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";

import {
  asyncNoop, exit, id, listProcesses, noop, useInstanceContextHarness,
} from "./instance-context-harness.ts";
import { launchHooks } from "./launch-extension-fixture.ts";

useInstanceContextHarness();

test.each(["before adoption", "after adoption"])("nested launcher exits %s", async order => {
  const { launchInstance, closeInstance } = GlobalInternals.instanceContext!;
  const { before } = getHooks().onMinecraftLaunch;
  const closed = mock(noop);
  const killed = mock(asyncNoop);
  const publicExit = mock(noop);
  let child!: MinecraftProcessType;

  getHooks().onMinecraftKill.after.push(killed);
  before.push(async options => {
    before.pop();
    const result = await spawnMinecraft({ ...options, "onClose": closed, "onInput": noop });

    if (!result.success) throw new Error("nested launch failed");
    child = result.process;
    if (order === "before adoption") exit(child.token);

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
  expect(killed).toHaveBeenCalledTimes(1);
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
