import * as events from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, mock, spyOn, test } from "bun:test";

import { trackRunningInstances } from "@/lib/launcher/scopes/track-running-instances.ts";
import { ProcessHandlers } from "@/lib/processes/core.ts";
import { spawnServer } from "@/lib/processes/spawn-server.ts";
import { watchProcesses } from "@/lib/watchers/watch-processes.ts";
import { serverProcesses } from "@/states/servers.ts";

import { useUiState } from "./ui-state.ts";

useUiState();

test("launch hydration retries listeners and handles each event once", async () => {
  const token = "retry-listeners";
  const process = { token, "pid": 1, "kind": "minecraft", "meta": { "instanceId": "game" } };

  const server = {
    "token": "extension", "pid"  : 2, "kind" : "extension-server",
    "meta" : { "name": "server", "port": 42 },
  };
  const kill = mock();

  mockIPC((command, arguments_) => (
    command === "list_processes" ? [process, server] : kill(command, arguments_)
  ));
  const active = (new Set<(name: string) => void>);
  let fail = true;

  using registrations = spyOn(events, "listen").mockImplementation(async (event, callback) => {
    if (event === "process-exited" && fail) {
      fail = false;
      throw new Error("Listener unavailable");
    }

    const dispatch = (name: string): void => {
      if (name === event) {
        const payload = { token, "lines": [], "stream": "stdout" };

        callback({
          event, "id": 1, "payload": payload as Parameters<typeof callback>[0]["payload"],
        });
      }
    };

    active.add(dispatch);

    return (): void => {
      active.delete(dispatch);
    };
  });
  const handlers = { "onOutput": mock(), "onExit": mock(), "onError": mock() };
  const hydrate = trackRunningInstances(() => handlers);

  expect(await hydrate()).toBe(false);
  ProcessHandlers.set(token, handlers);
  using cleanup = new DisposableStack;
  cleanup.defer(() => ProcessHandlers.delete(token));
  expect(active.size).toBe(0);
  expect(handlers.onOutput).not.toHaveBeenCalled();
  expect(await hydrate()).toBe(true);
  cleanup.defer(await watchProcesses());
  cleanup.defer(() => {
    ProcessHandlers.delete(server.token);
    serverProcesses.value = [];
  });
  expect(serverProcesses.value[0].name).toBe("server");
  await serverProcesses.value[0].value.kill();
  expect(kill).toHaveBeenCalledWith("kill_process", { "pid": 2 });
  for (const event of ["process-output", "process-error", "process-exited"]) {
    for (const dispatch of active) {
      dispatch(event);
    }
  }
  expect(registrations).toHaveBeenCalledTimes(6);
  for (const handler of Object.values(handlers)) {
    expect(handler).toHaveBeenCalledTimes(1);
  }
});

test("hydration skips exited tokens and retains a concurrently spawned server", async () => {
  const listed = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const attach = mock(() => ({}));
  const serverMeta = { "name": "server", "port": 42 };
  const snapshot = [
    { "token": "gone-game", "pid": 1, "kind": "minecraft", "meta": { "instanceId": "game" } },
    { "token": "gone-server", "pid": 2, "kind": "extension-server", "meta": serverMeta },
  ];
  const kill = mock();

  mockIPC(async (command, arguments_) => {
    if (command === "list_processes") {
      listed.resolve();
      await resume.promise;

      return snapshot;
    }
    if (command === "spawn_process") {
      const { spec } = arguments_ as { "spec": { "token": string } };

      return { ...spec, "pid": 3 };
    }

    return kill(command, arguments_);
  });
  let exit!: (token: string) => void;

  using registrations = spyOn(events, "listen").mockImplementation(async (event, callback) => {
    if (event === "process-exited") {
      exit = (token): void => callback({
        event, "id": 1, "payload": { token } as Parameters<typeof callback>[0]["payload"],
      });
    }

    return (): void => {};
  });
  using cleanup = new DisposableStack;
  const hydrated = trackRunningInstances(attach)();

  await listed.promise;
  cleanup.defer(await watchProcesses());
  const spawned = await spawnServer({
    ...serverMeta, "program": { "type": "path", "value": "server" }, "args": [],
  });

  cleanup.defer(() => {
    ProcessHandlers.delete(spawned.token);
    serverProcesses.value = [];
  });
  for (const { token } of snapshot) exit(token);
  resume.resolve();
  expect(await hydrated).toBe(true);
  expect(attach).not.toHaveBeenCalled();
  expect(serverProcesses.value).toEqual([spawned]);
  await spawned.value.kill();
  expect(kill).toHaveBeenCalledWith("kill_process", { "pid": 3 });
  expect(registrations).toHaveBeenCalledTimes(3);
  for (const { token } of snapshot) expect(ProcessHandlers.has(token)).toBe(false);
});
