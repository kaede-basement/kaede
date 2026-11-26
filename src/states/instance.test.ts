import { expect, spyOn, test } from "bun:test";
import { toRaw, watch } from "vue";

import { DefaultInstanceSettings } from "@/constants/launcher.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import {
  dispatchProcessExit, ProcessHandlers, rehydrateProcesses, toProcessHandle,
} from "@/lib/processes/core.ts";
import { SpawnObservers, spawnProcess } from "@/lib/processes/spawn-process.ts";
import States from "@/states";
import {
  ActiveRuns, checkpointActivePlaytime, commitPlaytime, declareInstanceStates, flushPlaytime,
  instanceStates, missingRunHandlers, restorePlaytime, startPlaytime,
} from "@/states/instance.ts";
import type { ProcessHandleType } from "@/types/application/server-process.type.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";

const id = "test-instance";
const token = "game";
const dto = { token, "meta": { "instanceId": id }, "pid": 1, "kind": "minecraft" };
const process = toProcessHandle(dto);

type Fixture = {
  "clock" : (mono: number, wall: number) => void;
  "quota" : (fail: boolean) => void;
  "reload": () => void;
  "ipc"   : (invoke: (cmd: string, arguments_: { "spec": typeof dto }) => unknown) => void;
  "saved" : Map<string, string>;
};

function instanceTest(title: string, check: (fixture: Fixture) => Promise<void>): void {
  test(title, () => withInstance(check));
}

async function withInstance(check: (fixture: Fixture) => Promise<void>): Promise<void> {
  const config = await getDefaultConfig();
  const previous = GlobalInternals.initialInstances;
  const singleton = instanceStates;
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const saved = new Map<string, string>;
  let rejectWrites = false;
  const wall = spyOn(Date, "now").mockReturnValue(5000);
  const mono = spyOn(performance, "now").mockReturnValue(100);

  Object.defineProperty(globalThis, "localStorage", {
    "configurable": true,
    "value"       : {
      get "length"() {
        return saved.size;
      },
      "key"       : (index: number) => [...saved.keys()][index] ?? null,
      "getItem"   : (key: string) => saved.get(key) ?? null,
      "removeItem": (key: string) => saved.delete(key),
      "setItem"   : (key: string, value: string) => {
        if (rejectWrites) {
          throw new Error("quota");
        }
        saved.set(key, value);
      },
    },
  });
  GlobalInternals.initialInstances = { [id]: {
    ...config.minecraft, ...DefaultInstanceSettings,
    "playTime": 25, "patchVersions": { "net.minecraft": "test" },
  } };
  const restore = declareInstanceStates();

  try {
    await check({
      saved,
      "clock": (now, date) => {
        mono.mockReturnValue(now);
        wall.mockReturnValue(date);
      },
      "quota": fail => {
        rejectWrites = fail;
      },
      "ipc": invoke => Object.defineProperty(globalThis, "window", {
        "configurable": true, "value": { "__TAURI_INTERNALS__": { invoke } },
      }),
      "reload": () => {
        GlobalInternals.initialInstances = structuredClone(toRaw(instanceStates));
        ActiveRuns.clear();
        declareInstanceStates();
        restorePlaytime();
      },
    });
  } finally {
    await flushPlaytime(async () => {});
    ActiveRuns.clear();
    ProcessHandlers.delete(token);
    restore();
    GlobalInternals.initialInstances = previous;
    mono.mockRestore();
    wall.mockRestore();
    const globals = [["localStorage", storage], ["window", windowDescriptor]] as const;

    for (const [key, descriptor] of globals) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }
    expect(States.instanceStates).toBe(singleton);
  }
}

for (const outcome of ["live", "absent", "exits during list", "buffer overflow"] as const) {
  instanceTest(`Recover playtime: ${outcome}`, async ({ clock, reload, ipc, saved }) => {
    startPlaytime(id, process);
    clock(1100, 6000);
    checkpointActivePlaytime();
    clock(5, 4000);
    reload();
    let calls = 0;

    ipc(() => {
      calls++;
      if (outcome === "buffer overflow" && calls === 1) {
        for (let index = 0; index < 300; index++) {
          dispatchProcessExit({ "token": String(index), "pid": 2, "code": 0, "signal": null });
        }
      }
      clock(calls === 1 ? 205 : 305, 4000);
      if (calls === 1 && (outcome === "exits during list" || outcome === "buffer overflow")) {
        dispatchProcessExit({ token, "pid": dto.pid, "code": 0, "signal": null });
      }

      return outcome === "absent" || calls > 1 ? [] : [dto];
    });
    const attach = (handle: ProcessHandleType): void => {
      startPlaytime(id, handle as MinecraftProcessType, true);
    };

    await rehydrateProcesses(handle => {
      attach(handle);

      return {};
    }, (handle, { endedAt }) => {
      attach(handle);
      commitPlaytime(id, token, endedAt);
    }, missingRunHandlers());
    if (outcome === "live") {
      expect(ActiveRuns.has(id)).toBe(true);
      commitPlaytime(id, token, performance.now());
    }
    commitPlaytime(id, token, performance.now());
    let persisted = 0;

    await flushPlaytime(async () => {
      persisted = instanceStates[id].playTime;
    });
    expect(persisted).toBe(1225);
    expect(ActiveRuns.has(id)).toBe(false);
    expect(saved.size).toBe(0);
  });
}

function observe(handle: ProcessHandleType, startedAt: number): void {
  startPlaytime(id, handle as MinecraftProcessType, false, startedAt);
}

instanceTest("Credit an exit before the spawn reply", async ({ clock, ipc }) => {
  SpawnObservers.add(observe);
  try {
    ipc((_cmd, { spec }) => {
      clock(175, 5075);
      dispatchProcessExit({ "token": spec.token, "pid": 7, "code": 0, "signal": null });
      expect(instanceStates[id].playTime).toBe(100);
      clock(300, 5200);

      return { ...spec, "pid": 7 };
    });
    const handle = await spawnProcess({
      "program": { "type": "path", "value": "java" }, "kind": "minecraft", "meta": dto.meta,
    }, {
      "onExit": () => commitPlaytime(id, ActiveRuns.get(id)!.process.token, performance.now()),
    });

    expect(ProcessHandlers.has(handle.token)).toBe(false);
    expect(ActiveRuns.has(id)).toBe(false);
    expect(instanceStates[id].playTime).toBe(100);
  } finally {
    SpawnObservers.delete(observe);
  }
});

for (const stage of ["spawn", "exit"] as const) {
  instanceTest(`Quota failure at ${stage}`, async ({ clock, quota, saved }) => {
    quota(stage === "spawn");
    startPlaytime(id, process);
    expect(ActiveRuns.has(id)).toBe(true);
    quota(false);
    checkpointActivePlaytime();
    clock(200, 9999);
    quota(stage === "exit");
    commitPlaytime(id, token, performance.now());
    expect(instanceStates[id].playTime).toBe(125);
    expect(ActiveRuns.has(id)).toBe(false);
    await expect(flushPlaytime(async () => {
      throw new Error("write failed");
    })).rejects.toThrow("write failed");
    quota(false);
    await flushPlaytime(async () => {});
    expect(instanceStates[id].playTime).toBe(125);
    expect(saved.size).toBe(0);
  });
}

instanceTest("Preserve a replacement process during replay", async ({ clock, saved }) => {
  startPlaytime(id, process);
  clock(1100, 6000);
  commitPlaytime(id, token, performance.now());
  await expect(flushPlaytime(async () => {
    throw new Error("write failed");
  })).rejects.toThrow("write failed");
  declareInstanceStates();
  expect(instanceStates[id].playTime).toBe(25);
  restorePlaytime();
  restorePlaytime();
  expect(instanceStates[id].playTime).toBe(1025);
  const previousFlush = flushPlaytime(async () => {});
  const next = { ...process, "token": "replacement" };

  startPlaytime(id, next);
  commitPlaytime(id, token, performance.now());
  await previousFlush;
  expect(saved.size).toBe(1);
  expect(ActiveRuns.get(id)?.process.token).toBe(next.token);
  commitPlaytime(id, next.token, performance.now());
  await flushPlaytime(async () => {});
  expect(saved.size).toBe(0);
});

instanceTest("Coexisting runs accrue only their own elapsed time", async ({ clock, reload }) => {
  const second = "second-instance";

  instanceStates[second] = structuredClone(toRaw(instanceStates[id]));
  const other = toProcessHandle({
    ...dto, "token": "second-game", "meta": { "instanceId": second },
  });
  let changes = 0;
  const stop = watch(instanceStates, () => {
    changes++;
  }, { "flush": "sync" });

  try {
    startPlaytime(id, process);
    clock(300, 5200);
    startPlaytime(second, other);
    clock(1100, 6000);
    checkpointActivePlaytime();
    expect(changes).toBe(2);
    expect(instanceStates[id].playTime).toBe(25);
    expect(GlobalInternals.initialInstances[id].lastLaunch).toBe(0);
    clock(5, 6200);
    reload();
    startPlaytime(id, process, true);
    startPlaytime(second, other, true);
    expect(instanceStates[id].lastLaunch).toBe(5000);
    expect(instanceStates[second].lastLaunch).toBe(5200);
    clock(205, 7000);
    commitPlaytime(id, process.token, performance.now());
    commitPlaytime(second, other.token, performance.now());
    expect(instanceStates[id].playTime).toBe(1425);
    expect(instanceStates[second].playTime).toBe(1225);
  } finally {
    stop();
  }
});
