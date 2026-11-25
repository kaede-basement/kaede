import { expect, spyOn, test } from "bun:test";

import { serverProcesses } from "@/states/servers.ts";

import * as processes from "./spawn-process.ts";
import { spawnServer } from "./spawn-server.ts";

test("a server that exited before its spawn response is never returned or registered", async () => {
  const pid = 991;

  using spawn = spyOn(processes, "spawnProcess").mockImplementation(async (options, handlers) => {
    handlers?.onExit?.({ pid, "token": "test", "code": 1, "signal": null });

    return {
      pid, "token": "test", "kind" : options.kind, "meta" : options.meta,
      "kill" : async (): Promise<void> => {}, "write": async (): Promise<void> => {},
    };
  });

  await expect(spawnServer({
    "name": "test", "port": 0, "program": { "type": "path", "value": "server" }, "args": [],
  })).rejects.toThrow("exited during startup");
  expect(spawn).toHaveBeenCalledTimes(1);
  expect(serverProcesses.value.some(item => item.value.pid === pid)).toBe(false);
});
