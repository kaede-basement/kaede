import * as fs from "@tauri-apps/plugin-fs";
import { expect, mock, spyOn, test } from "bun:test";

import { LaunchStatus } from "@/constants/launcher.ts";
import Hooks from "@/lib/hooks";
import Processes from "@/lib/processes";
import { dispatchProcessExit, recordSpawnLifetime } from "@/lib/processes/core.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

import { spawnMinecraft } from "./spawn-minecraft.ts";

test("Minecraft exiting before spawn returns never publishes a running handle", async () => {
  const onClose = mock();
  const necessaries = {
    "statuses": {}, "directories": { "instance": "game" },
  } as PreLaunchInformationType;

  using mkdir = spyOn(fs, "mkdir").mockResolvedValue();
  using spawn = spyOn(Processes, "spawnProcess").mockImplementation(async (options, _, onSpawn) => {
    const child = {
      "pid"  : 1, "token": "test", "kind" : options.kind, "meta" : options.meta,
      "kill" : async (): Promise<void> => {}, "write": async (): Promise<void> => {},
    };

    recordSpawnLifetime(child, performance.now());
    onSpawn?.(child, performance.now());
    dispatchProcessExit({ "pid": 1, "code": 1, "signal": null, "token": child.token });

    return child;
  });
  const hooks = mock<typeof Hooks.catchAsyncVoidHooks>(async () => {});
  const original = Object.getOwnPropertyDescriptor(Hooks, "catchAsyncVoidHooks");

  using cleanup = new DisposableStack;
  cleanup.defer(() => {
    if (original) {
      Object.defineProperty(Hooks, "catchAsyncVoidHooks", original);
    } else {
      Reflect.deleteProperty(Hooks, "catchAsyncVoidHooks");
    }
  });
  Object.defineProperty(Hooks, "catchAsyncVoidHooks", { "configurable": true, "value": hooks });

  expect(await spawnMinecraft({
    "command"   : { "java": "java", "arguments": [] }, "instanceId": "game",
    necessaries, onClose, "onInput"   : () => {},
  })).toEqual({ "success": false, "process": undefined });
  expect(onClose).toHaveBeenCalledWith("game");
  expect(necessaries.statuses.current).toBe(LaunchStatus.Errors.UnhandledError);
  expect(hooks.mock.calls.map(([options]) => options.scope)).toEqual(["onMinecraftKill"]);
  expect(spawn).toHaveBeenCalledTimes(1);
  expect(mkdir).toHaveBeenCalledWith("game", { "recursive": true });
});
