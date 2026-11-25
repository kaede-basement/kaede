import * as events from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, mock, spyOn, test } from "bun:test";

import { trackRunningInstances } from "@/lib/launcher/scopes/track-running-instances.ts";
import { ProcessHandlers } from "@/lib/processes/core.ts";
import { watchProcesses } from "@/lib/watchers/watch-processes.ts";

import { useUiState } from "./ui-state.ts";

useUiState();

test("launch hydration retries listeners and handles each event once", async () => {
  const token = "retry-listeners";
  const process = { token, "pid": 1, "kind": "minecraft", "meta": { "instanceId": "game" } };

  mockIPC(() => [process]);
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
