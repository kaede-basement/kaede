import { expect, spyOn, test } from "bun:test";

import * as watchers from "@/lib/watchers/watch-processes.ts";
import { serverProcesses } from "@/states/servers.ts";

import * as processes from "./spawn-process.ts";
import { spawnServer } from "./spawn-server.ts";

test("a server that exited before its spawn response is never returned or registered", async () => {
  const pid = 991;
  const ready = Promise.withResolvers<() => void>();

  using watch = spyOn(watchers, "watchProcesses").mockReturnValue(ready.promise);

  using spawn = spyOn(processes, "spawnProcess").mockImplementation(async (options, handlers) => {
    handlers?.onExit?.({ pid, "token": "test", "code": 1, "signal": null });

    return {
      pid, "token": "test", "kind" : options.kind, "meta" : options.meta,
      "kill" : async (): Promise<void> => {}, "write": async (): Promise<void> => {},
    };
  });

  const pending = spawnServer({
    "name": "test", "port": 0, "program": { "type": "path", "value": "server" }, "args": [],
  });

  expect(watch).toHaveBeenCalledTimes(1);
  expect(spawn).not.toHaveBeenCalled();
  ready.resolve(() => {});
  await expect(pending).rejects.toThrow("exited during startup");
  expect(spawn).toHaveBeenCalledTimes(1);
  expect(serverProcesses.value.some(item => item.value.pid === pid)).toBe(false);
});
