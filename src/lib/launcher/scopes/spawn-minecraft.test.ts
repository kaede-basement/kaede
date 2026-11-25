import * as fs from "@tauri-apps/plugin-fs";
import { expect, mock, spyOn, test } from "bun:test";

import { LaunchStatus } from "@/constants/launcher.ts";
import Hooks from "@/lib/hooks";
import Processes from "@/lib/processes";
import { toProcessHandle } from "@/lib/processes/core.ts";
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
  using spawn = spyOn(Processes, "spawnProcess").mockImplementation(async (options, handlers) => {
    const child = {
      "pid"  : 1, "token": "test", "kind" : options.kind, "meta" : options.meta,
      "kill" : async (): Promise<void> => {}, "write": async (): Promise<void> => {},
    };

    handlers?.onExit?.({ "pid": 1, "code": 1, "signal": null });

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

const child = toProcessHandle({
  "pid": 7, "token": "replacement", "kind": "minecraft", "meta": { "instanceId": "veto" },
});

test.each([
  { "success": true, "process": undefined },
  { "success": false, "process": child },
  { "success": false },
  undefined,
])("preserve the launch hook result %p", async response => {
  using hooks = spyOn(Hooks, "catchAsyncResponseHooks").mockResolvedValue(response);
  using mkdir = spyOn(fs, "mkdir").mockResolvedValue();
  const result = await spawnMinecraft({
    "command"    : { "java": "java", "arguments": [] }, "instanceId" : "veto",
    "necessaries": { "directories": { "instance": "game" } } as PreLaunchInformationType,
    "onClose"    : () => {}, "onInput"    : () => {},
  });

  expect(hooks).toHaveBeenCalledTimes(1);
  expect(mkdir).toHaveBeenCalledTimes(1);
  expect(result).toStrictEqual({
    "success": response?.success ?? false, "process": response?.process,
  });
  expect(result.process).toBe(response?.process);
  expect(Object.keys(result)).toContain("process");
});
