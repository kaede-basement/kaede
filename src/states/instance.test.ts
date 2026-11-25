import { expect, spyOn, test } from "bun:test";
import { watch } from "vue";

import { DefaultInstanceSettings } from "@/constants/launcher.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import States from "@/states";
import {
  commitPlaytime,
  declareInstanceStates,
  instanceStates,
  RunStartedAt,
  startPlaytime,
} from "@/states/instance.ts";

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
      "setItem"   : (key: string, value: string) => saved.set(key, value),
      "getItem"   : (key: string) => saved.get(key) ?? null,
      "removeItem": (key: string) => saved.delete(key),
    },
  });
  const clock = spyOn(Date, "now").mockReturnValue(5000);

  GlobalInternals.initialInstances = { "first": instance, "second": structuredClone(instance) };
  declareInstanceStates();
  let changes = 0;
  const stop = watch(instanceStates, () => {
    changes++;
  }, { "flush": "sync" });

  try {
    expect(States.instanceStates).toBe(instanceStates);
    startPlaytime("first", "process-1");
    expect(instanceStates.first.lastLaunch).toBe(5000);
    expect(changes).toBe(1);
    clock.mockReturnValue(7000);
    startPlaytime("second", "process-2");
    RunStartedAt.clear();
    startPlaytime("first", "process-1", true);
    expect(RunStartedAt.get("first")).toBe(5000);
    clock.mockReturnValue(8000);
    startPlaytime("second", "different-process", true);
    expect(RunStartedAt.get("second")).toBe(8000);
    clock.mockReturnValue(9000);
    startPlaytime("second", "different-process", true);
    expect(instanceStates.second.lastLaunch).toBe(7000);
    expect(instanceStates.first.playTime).toBe(25);
    expect(changes).toBe(2);
    commitPlaytime("first");
    commitPlaytime("first");
    expect(instanceStates.first.playTime).toBe(4025);
    expect(instanceStates.second.playTime).toBe(25);
    commitPlaytime("second");
    expect(instanceStates.second.playTime).toBe(1025);
    expect(changes).toBe(4);
    expect(instance.playTime).toBe(25);
    expect(instance.lastLaunch).toBe(0);
    expect(saved.size).toBe(0);
  } finally {
    stop();
    clock.mockRestore();
    GlobalInternals.initialInstances = previous;
    declareInstanceStates();
    RunStartedAt.clear();
    if (storage) {
      Object.defineProperty(globalThis, "localStorage", storage);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  }
});
