import { expect, spyOn, test } from "bun:test";
import { watch } from "vue";

import { DefaultInstanceSettings } from "@/constants/launcher.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { toProcessHandle } from "@/lib/processes/core.ts";
import States from "@/states";
import {
  ActiveRuns,
  commitPlaytime,
  declareInstanceStates,
  flushPlaytime,
  instanceStates,
  restoreFinishedPlaytime,
  startPlaytime,
} from "@/states/instance.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";

function handle(instanceId: string, token: string): MinecraftProcessType {
  return toProcessHandle({ token, "meta": { instanceId }, "pid": 1, "kind": "minecraft" });
}

test("Restore the matching run and commit elapsed time once per exit", async () => {
  const config = await getDefaultConfig();
  const instance = {
    ...config.minecraft, ...DefaultInstanceSettings,
    "patchVersions": { "net.minecraft": "test" },
    "playTime"     : 25,
  };
  const previous = GlobalInternals.initialInstances;
  const saved = new Map<string, string>;
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

  Object.defineProperty(globalThis, "localStorage", {
    "configurable": true,
    "value"       : {
      get "length"() {
        return saved.size;
      },
      "key"       : (index: number) => [...saved.keys()][index] ?? null,
      "setItem"   : (key: string, value: string) => saved.set(key, value),
      "getItem"   : (key: string) => saved.get(key) ?? null,
      "removeItem": (key: string) => saved.delete(key),
    },
  });
  const clock = spyOn(Date, "now").mockReturnValue(5000);

  const monotonic = spyOn(performance, "now").mockReturnValue(100);

  GlobalInternals.initialInstances = { "first": instance, "second": structuredClone(instance) };
  declareInstanceStates();
  let changes = 0;
  const stop = watch(instanceStates, () => {
    changes++;
  }, { "flush": "sync" });

  try {
    expect(States.instanceStates).toBe(instanceStates);
    startPlaytime("first", handle("first", "process-1"));
    expect(instanceStates.first.lastLaunch).toBe(5000);
    expect(changes).toBe(1);
    clock.mockReturnValue(7000);
    startPlaytime("second", handle("second", "process-2"));
    ActiveRuns.clear();
    startPlaytime("first", handle("first", "process-1"), true);
    expect(ActiveRuns.get("first")?.startedAt).toBe(-1900);
    clock.mockReturnValue(8000);
    startPlaytime("second", handle("second", "different-process"), true);
    expect(ActiveRuns.get("second")?.startedAt).toBe(100);
    clock.mockReturnValue(9000);
    startPlaytime("second", handle("second", "different-process"), true);
    expect(instanceStates.second.lastLaunch).toBe(7000);
    expect(instanceStates.first.playTime).toBe(25);
    expect(changes).toBe(2);
    clock.mockReturnValue(30_000);
    monotonic.mockReturnValue(3100);
    commitPlaytime("first", "process-1", performance.now());
    commitPlaytime("first", "process-1", performance.now());
    expect(instanceStates.first.playTime).toBe(5025);
    expect(instanceStates.second.playTime).toBe(25);
    commitPlaytime("second", "different-process", performance.now());
    expect(instanceStates.second.playTime).toBe(4025);
    expect(changes).toBe(4);
    expect(instance.playTime).toBe(25);
    expect(instance.lastLaunch).toBe(0);

    await expect(flushPlaytime(async () => {
      throw new Error("write failed");
    }))
      .rejects.toThrow("write failed");
    declareInstanceStates();
    expect(restoreFinishedPlaytime()).toBe(true);
    expect(instanceStates.first.playTime).toBe(5025);
    expect(instanceStates.second.playTime).toBe(4025);
    restoreFinishedPlaytime();
    expect(instanceStates.first.playTime).toBe(5025);
    const previousFlush = flushPlaytime(async () => {});

    startPlaytime("first", handle("first", "new-token"));
    commitPlaytime("first", "process-1", performance.now());
    await previousFlush;
    expect(saved.size).toBe(1);
    expect(ActiveRuns.get("first")?.process.token).toBe("new-token");
    commitPlaytime("first", "new-token", performance.now());
    await flushPlaytime(async () => {});
    expect(saved.size).toBe(0);
  } finally {
    stop();
    monotonic.mockRestore();
    clock.mockRestore();
    GlobalInternals.initialInstances = previous;
    declareInstanceStates();
    ActiveRuns.clear();
    if (storage) {
      Object.defineProperty(globalThis, "localStorage", storage);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  }
});
