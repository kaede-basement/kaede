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
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import { activeRun, operation } from "@/states/instance-operation.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

const id = "test";

type LaunchInput = Parameters<typeof handleLaunch>[0];
const prepareAndSpawn = mock(({ instanceId, statuses, onClose, onInput }: LaunchInput) => (
  spawnMinecraft({
    instanceId, onClose, onInput, "command"    : { "java": "java", "arguments": [] },
    "necessaries": { statuses, "directories": { "instance": id } } as PreLaunchInformationType,
  })
));

const noop = (): void => {};
const asyncNoop = async (): Promise<void> => {};

beforeAll(async () => {
  Object.assign(globalThis, { "window": { crypto } });
  mockIPC((cmd, arguments_) => {
    if (cmd === "list_processes") return [];
    if (cmd === "spawn_process") return { ...(arguments_ as { "spec": object }).spec, "pid": 1 };
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

test("await close permits relaunch before the native exit arrives", async () => {
  const { launchInstance, closeInstance, launches } = GlobalInternals.instanceContext!;
  const clock = spyOn(performance, "now").mockReturnValue(100);
  const initial = instanceStates[id].playTime;

  await launchInstance(id);
  const token = activeRun(id)!.process.token;

  clock.mockReturnValue(600);
  await closeInstance(id);
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

  if (mode === "exit") exit(token);
  else await closeInstance(id);
  expect(activeRun(id)).toBeUndefined();
  expect(instanceStates[id].playTime).toBe(initial + 700);
  expect(launches[id].launching).toBe(1);
  const calls = prepareAndSpawn.mock.calls.length;

  await launchInstance(id);
  expect(prepareAndSpawn).toHaveBeenCalledTimes(calls);
  release.resolve();
  await launch;
  if (mode === "kill") exit(token);
  expect(operation(id).kind).toBe("idle");
  expect(launches[id].launching).toBe(0);
  expect(instanceStates[id].playTime).toBe(initial + 700);
});
