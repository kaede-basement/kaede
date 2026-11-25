import "../../scripts/setup-component-tests.ts";

import { mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeAll, expect, mock, spyOn, test } from "bun:test";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";

import { AuthOneTimeFetchContextKey } from "@/constants/application.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getHooks } from "@/extendable/hooks-registry.ts";
import type { handleLaunch } from "@/lib/launcher/scopes/handle-launch.ts";
import { spawnMinecraft } from "@/lib/launcher/scopes/spawn-minecraft.ts";
import { dispatchProcessExit, toProcessHandle } from "@/lib/processes/core.ts";
import { spawnProcess } from "@/lib/processes/spawn-process.ts";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import { activeRun, operation } from "@/states/instance-operation.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

const id = "test";

type LaunchInput = Parameters<typeof handleLaunch>[0];
const prepareAndSpawn = mock(({ instanceId, statuses, onClose, onInput, onSpawn }: LaunchInput) => (
  spawnMinecraft({
    instanceId, onClose, onInput, onSpawn, "command"    : { "java": "java", "arguments": [] },
    "necessaries": { statuses, "directories": { "instance": id } } as PreLaunchInformationType,
  })
));

const nativeKill = mock((pid: number) => pid);
const noop = (): void => {};
const asyncNoop = async (): Promise<void> => {};

beforeAll(async () => {
  Object.assign(globalThis, { "window": { crypto } });
  let pid = 0;

  mockIPC((cmd, arguments_) => {
    if (cmd === "list_processes") return [];
    if (cmd === "kill_process") nativeKill((arguments_ as { "pid": number }).pid);
    if (cmd === "spawn_process") {
      return { ...(arguments_ as { "spec": object }).spec, "pid": ++pid };
    }
  });
  mock.module("@/lib/launcher", () => ({ "default": { "handleLaunch": prepareAndSpawn } }));
  const findCurrent = (): { "id": string; "instance": InstanceStateType } => (
    { id, "instance": instanceStates[id] }
  );

  mock.module("@/lib/instances", () => ({
    "default": { findCurrent, "sync": asyncNoop },
  }));
  mock.module("@/lib/auth", () => ({ "default": { "resolveLaunchAccount": asyncNoop } }));
  mock.module("@/lib/watchers", () => ({
    "default": { "watchProcesses": asyncNoop, "watchLogModeStates": noop },
  }));
  mock.module("@/states/global.ts", () => ({ "globalStates": { "logs": {} } }));
  GlobalInternals.javaMajor = 21;
  GlobalInternals.initialInstances = { [id]: { "playTime": 0 } as InstanceStateType };
  declareInstanceStates();
  const { "default": provider } = await import("@/components/general/misc/ContextProviders.vue");

  const app = createSSRApp({ ...provider, "render": () => null });

  app.provide(AuthOneTimeFetchContextKey, []);
  await renderToString(app);
});

afterEach(() => {
  getHooks().onMinecraftLaunch.before.length = 0;
  getHooks().onMinecraftLaunch.after.length = 0;
  mock.restore();
});

function exit(token: string): void {
  dispatchProcessExit({ token, "pid": 1, "code": 0, "signal": null });
}

test("await close permits relaunch only after the native exit arrives", async () => {
  const { launchInstance, closeInstance, launches } = GlobalInternals.instanceContext!;
  const clock = spyOn(performance, "now").mockReturnValue(100);
  const initial = instanceStates[id].playTime;

  await launchInstance(id);
  const token = activeRun(id)!.process.token;

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

test("a replacement process can reject Stop, then close without an exit notification", async () => {
  const { launchInstance, closeInstance } = GlobalInternals.instanceContext!;
  const process = toProcessHandle({
    "token": "extension", "pid": 2, "kind": "minecraft", "meta": { "instanceId": id },
  });
  const kill = mock(async () => {});

  kill.mockRejectedValueOnce(new Error("kill rejected"));
  process.kill = kill;
  // @ts-expect-error JavaScript extensions can return a process despite the void declaration.
  getHooks().onMinecraftLaunch.before.push(async () => ({
    "status": "stop", "response": { "success": true, process },
  }));
  await launchInstance(id);
  await closeInstance(id);
  expect(operation(id).kind).toBe("running");
  await closeInstance(id);
  expect(kill).toHaveBeenCalledTimes(2);
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

  // @ts-expect-error JavaScript extensions can return a process despite the void declaration.
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
  expect(operation(id).kind).toBe("idle");
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
