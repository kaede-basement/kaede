import * as fs from "@tauri-apps/plugin-fs";
import { expect, mock, spyOn, test } from "bun:test";

import { LaunchStatus } from "@/constants/launcher.ts";
import Hooks from "@/lib/hooks";
import Processes from "@/lib/processes";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

import Fetching from "./fetching";
import { launchAttempts } from "./fetching/download-outcome.ts";
import { cancelLaunchDownloads } from "./handle-launch.ts";
import { spawnMinecraft } from "./spawn-minecraft.ts";

test("Minecraft exiting before spawn returns never publishes a running handle", async () => {
  const onClose = mock();
  const necessaries = {
    "statuses": {}, "directories": { "instance": "game" },
  } as PreLaunchInformationType;

  using mkdir = spyOn(fs, "mkdir").mockResolvedValue();
  using spawn = spyOn(Processes, "spawnProcess").mockImplementation(async (options, handlers) => {
    handlers?.onExit?.({ "pid": 1, "token": "test", "code": 1, "signal": null });

    return {
      "pid"  : 1, "token": "test", "kind" : options.kind, "meta" : options.meta,
      "kill" : async (): Promise<void> => {}, "write": async (): Promise<void> => {},
    };
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

for (const phase of ["spawn", "after-hook"]) {
  test("confirmed Stop during " + phase + " kills the child before returning", async () => {
    const entered = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const pause = async (): Promise<void> => {
      entered.resolve();
      await resume.promise;
    };
    const kill = mock(async () => {});

    using mkdir = spyOn(fs, "mkdir").mockResolvedValue();
    using cancel = spyOn(Fetching, "cancelAll").mockResolvedValue(false);
    using spawn = spyOn(Processes, "spawnProcess").mockImplementation(async options => {
      if (phase === "spawn") await pause();

      return {
        "pid"  : 42, "token": "child", "kind" : options.kind, "meta" : options.meta,
        kill, "write": async (): Promise<void> => {},
      };
    });
    using after = spyOn(Hooks, "catchAsyncVoidHooks").mockImplementation(pause);
    const necessaries = {
      "statuses": { "instanceId": "game" }, "directories": { "instance": "game" },
    } as PreLaunchInformationType;

    launchAttempts.set(necessaries.statuses, {});
    const result = spawnMinecraft({
      "command"   : { "java": "java", "arguments": [] }, "instanceId": "game",
      necessaries, "onClose"   : mock(), "onInput"   : mock(),
    });

    await entered.promise;
    await cancelLaunchDownloads(necessaries.statuses);
    resume.resolve();
    expect(await result).toEqual({ "success": false, "process": undefined, "reason": "cancelled" });
    expect(necessaries.statuses.current).not.toBe(LaunchStatus.General.Success);
    expect(kill).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(phase === "spawn" ? 0 : 1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(mkdir).toHaveBeenCalledTimes(1);
  });
}
