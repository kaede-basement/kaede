import "../../scripts/setup-component-tests.ts";

import { mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeAll, mock } from "bun:test";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";

import { AuthOneTimeFetchContextKey } from "@/constants/application.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getHooks } from "@/extendable/hooks-registry.ts";
import type { handleLaunch } from "@/lib/launcher/scopes/handle-launch.ts";
import { spawnMinecraft } from "@/lib/launcher/scopes/spawn-minecraft.ts";
import { dispatchProcessExit } from "@/lib/processes/core.ts";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { ProcessDtoType } from "@/types/application/server-process.type.ts";
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

const listProcesses = mock((): Array<ProcessDtoType> => []);
const nativeKill = mock((pid: number) => pid);
const noop = (): void => {};
const asyncNoop = async (): Promise<void> => {};

async function initialize(): Promise<void> {
  Object.assign(globalThis, { "window": { crypto } });
  let pid = 0;

  mockIPC((cmd, arguments_) => {
    if (cmd === "list_processes") return listProcesses();
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
  await mountProvider();
}

async function mountProvider(): Promise<void> {
  const { "default": provider } = await import("@/components/general/misc/ContextProviders.vue");

  const app = createSSRApp({ ...provider, "render": () => null });

  app.provide(AuthOneTimeFetchContextKey, []);
  await renderToString(app);
}

export function useInstanceContextHarness(): void {
  beforeAll(initialize);
  afterEach(() => {
    getHooks().onMinecraftKill.after.length = 0;
    getHooks().onMinecraftLaunch.before.length = 0;
    getHooks().onMinecraftLaunch.after.length = 0;
    mock.restore();
  });
}

function exit(token: string): void {
  dispatchProcessExit({ token, "pid": 1, "code": 0, "signal": null });
}

export { asyncNoop, exit, id, listProcesses, mountProvider, nativeKill, noop, prepareAndSpawn };
