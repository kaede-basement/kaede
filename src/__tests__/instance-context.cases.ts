import { expect, mock, spyOn, test } from "bun:test";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getHooks } from "@/extendable/hooks-registry.ts";
import { toProcessHandle } from "@/lib/processes/core.ts";
import { spawnProcess } from "@/lib/processes/spawn-process.ts";
import { instanceStates } from "@/states/instance.ts";
import { activeRun, operation } from "@/states/instance-operation.ts";

import {
  asyncNoop, exit, id, nativeKill, noop, prepareAndSpawn,
  useInstanceContextHarness,
} from "./instance-context-harness.ts";

useInstanceContextHarness();

test.each(["success", "missing"])("close waits for native exit after kill %s", async outcome => {
  const { launchInstance, closeInstance, launches } = GlobalInternals.instanceContext!;
  const clock = spyOn(performance, "now").mockReturnValue(100);
  const initial = instanceStates[id].playTime;

  await launchInstance(id);
  const token = activeRun(id)!.process.token;

  if (outcome === "missing") {
    nativeKill.mockImplementationOnce(pid => {
      throw new Error(`no managed process with pid ${pid}`);
    });
  }
  clock.mockReturnValue(250);
  const closed = mock(noop);
  const close = closeInstance(id).then(closed);
  const duplicate = closeInstance(id).then(closed);

  await Bun.sleep(0);
  expect(operation(id).kind).toBe("stopping");
  expect(closed).not.toHaveBeenCalled();
  const launchesBefore = prepareAndSpawn.mock.calls.length;

  await launchInstance(id);
  expect(prepareAndSpawn).toHaveBeenCalledTimes(launchesBefore);
  expect(instanceStates[id].playTime).toBe(initial);
  clock.mockReturnValue(600);
  exit(token);
  await Promise.all([close, duplicate]);
  expect(instanceStates[id].playTime).toBe(initial + 500);
  await launchInstance(id);
  const next = activeRun(id)!;

  expect(next.process.token).not.toBe(token);
  exit(token);
  expect(activeRun(id)).toBe(next);
  expect(launches[id].launching).toBe(2);
  expect(instanceStates[id].playTime).toBe(initial + 500);
  exit(next.process.token);
});

test("a launch hook can veto with a failed result or continue without a response", async () => {
  const { launchInstance } = GlobalInternals.instanceContext!;
  const { before } = getHooks().onMinecraftLaunch;

  before.push(async () => ({ "status": "stop", "response": { "success": false } }));
  await launchInstance(id);
  expect(operation(id).kind).toBe("idle");
  before.pop();
  before.push(async () => ({ "status": "continue" }));
  await launchInstance(id);
  expect(operation(id).kind).toBe("running");
  exit(activeRun(id)!.process.token);
});

test("a replacement process can reject Stop, then close without an exit notification", async () => {
  const { launchInstance, closeInstance } = GlobalInternals.instanceContext!;
  const process = toProcessHandle({
    "token": "extension", "pid": 2, "kind": "minecraft", "meta": { "instanceId": id },
  });
  const kill = mock(async () => {});
  const killed = mock(asyncNoop);

  getHooks().onMinecraftKill.after.push(killed);

  kill.mockRejectedValueOnce(new Error("kill rejected"));
  process.kill = kill;
  getHooks().onMinecraftLaunch.before.push(async () => ({
    "status": "stop", "response": { "success": true, process },
  }));
  await launchInstance(id);
  await closeInstance(id);
  expect(operation(id).kind).toBe("running");
  await closeInstance(id);
  expect(kill).toHaveBeenCalledTimes(2);
  expect(killed).toHaveBeenCalledTimes(1);
  expect(killed).toHaveBeenCalledWith(process.pid);
  expect(operation(id).kind).toBe("idle");
});

test("a before hook owns only its selected child and awaits that child's native exit", async () => {
  const { launchInstance, closeInstance } = GlobalInternals.instanceContext!;
  const spec = {
    "program": { "type": "path", "value": "java" },
    "kind"   : "minecraft", "meta"   : { "instanceId": id },
  } as const;
  let selected!: Awaited<ReturnType<typeof spawnProcess<{ "instanceId": string }>>>;
  const childExit = mock(noop);
  const killed = mock(asyncNoop);

  getHooks().onMinecraftKill.after.push(killed);

  getHooks().onMinecraftLaunch.before.push(async () => {
    const helper = await spawnProcess(spec);

    exit(helper.token);
    selected = await spawnProcess(spec, { "onExit": childExit });

    return { "status": "stop", "response": { "success": true, "process": selected } };
  });
  await launchInstance(id);
  expect(activeRun(id)?.process).toBe(selected);
  const closing = closeInstance(id);

  await Bun.sleep(0);
  expect(nativeKill).toHaveBeenLastCalledWith(selected.pid);
  expect(operation(id).kind).toBe("stopping");
  exit(selected.token);
  await closing;
  expect(childExit).toHaveBeenCalledTimes(1);
  expect(killed).toHaveBeenCalledTimes(1);
  expect(killed).toHaveBeenCalledWith(selected.pid);
  expect(operation(id).kind).toBe("idle");
});

test("a decorated child returned after native exit credits its actual lifetime once", async () => {
  const clock = spyOn(performance, "now").mockReturnValue(100);
  const { launchInstance } = GlobalInternals.instanceContext!;
  const initial = instanceStates[id].playTime;

  const child = await spawnProcess({
    "program": { "type": "path", "value": "java" },
    "kind"   : "minecraft", "meta"   : { "instanceId": id },
  });
  const process = { ...child, "kill": (): Promise<void> => child.kill() };

  clock.mockReturnValue(200);
  exit(child.token);
  for (let index = 0; index < 1000; index++) exit("unrelated-" + index);
  clock.mockReturnValue(900);
  getHooks().onMinecraftLaunch.before.push(async () => ({
    "status": "stop", "response": { "success": true, process },
  }));
  await launchInstance(id);
  expect(operation(id).kind).toBe("idle");
  expect(instanceStates[id].playTime).toBe(initial + 100);
  await launchInstance(id);
  expect(operation(id).kind).toBe("idle");
  expect(instanceStates[id].playTime).toBe(initial + 100);
  getHooks().onMinecraftLaunch.before.pop();
  await launchInstance(id);
  expect(operation(id).kind).toBe("running");
  exit(activeRun(id)!.process.token);
  expect(instanceStates[id].playTime).toBe(initial + 100);
});

test.each(["exit", "kill"])("%s retains ownership until the after hook settles", async mode => {
  const { launchInstance, closeInstance, launches } = GlobalInternals.instanceContext!;
  const clock = spyOn(performance, "now").mockReturnValue(100);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const initial = instanceStates[id].playTime;

  getHooks().onMinecraftLaunch.after.push(async () => {
    entered.resolve();
    await release.promise;
  });
  const launch = launchInstance(id);

  await entered.promise;
  expect(launches[id].launching).toBe(1);
  clock.mockReturnValue(800);
  const token = activeRun(id)!.process.token;

  const closing = mode === "kill" ? closeInstance(id) : undefined;

  await Bun.sleep(0);
  exit(token);
  await closing;
  expect(activeRun(id)).toBeUndefined();
  expect(instanceStates[id].playTime).toBe(initial + 700);
  expect(launches[id].launching).toBe(1);
  const calls = prepareAndSpawn.mock.calls.length;

  await launchInstance(id);
  expect(prepareAndSpawn).toHaveBeenCalledTimes(calls);
  release.resolve();
  await launch;

  expect(operation(id).kind).toBe("idle");
  expect(launches[id].launching).toBe(0);
  expect(instanceStates[id].playTime).toBe(initial + 700);
});
