import { expect, test } from "bun:test";

import { isManagedDownloadMap } from "@/lib/network/download-map.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";

import {
  beginInstall, beginLaunch, finishInstall, finishLaunch, finishRun, Launches,
  operation, recordRun, stopRun,
} from "./instance-operation.ts";

test("one operation owns each instance through installation, launch, stop and exit", async () => {
  const id = "owner-test";
  const process = { "pid": 1, "token": "token" } as MinecraftProcessType;
  const install = beginInstall(id);

  expect(operation(id)).toBe(install);
  expect(Launches[id].current).toBeUndefined();
  expect(Launches[id].downloads.current).toBe(install.statuses.downloads.current);
  expect(isManagedDownloadMap(Launches[id].downloads.current)).toBe(true);
  expect(beginLaunch(id)).toBeUndefined();
  expect(recordRun(id, process, 0, true)).toBe(false);
  finishInstall(install);
  expect(Launches[id]).toBeUndefined();
  const failed = beginLaunch(id)!;

  expect(beginLaunch(id)).toBeUndefined();
  expect(() => beginInstall(id)).toThrow();
  expect(recordRun(id, process, 0, true)).toBe(false);
  finishLaunch(id, failed);
  expect(operation(id).kind).toBe("idle");
  const progress = beginLaunch(id)!;
  const map = progress.downloads.current;

  expect(isManagedDownloadMap(map)).toBe(true);
  expect(recordRun(id, process, 0, false)).toBe(true);
  finishLaunch(id, failed);
  expect(Launches[id].launching).toBe(1);
  finishLaunch(id, progress);
  expect(Launches[id]).toBe(progress);
  expect(Launches[id].launching).toBe(2);
  const veto = Promise.withResolvers<void>();
  const stopping = stopRun(id, () => veto.promise);

  expect(stopRun(id, async () => {})).toBe(stopping);
  expect(beginLaunch(id)).toBeUndefined();
  veto.resolve();
  await stopping;
  expect(operation(id).kind).toBe("running");
  const closed = stopRun(id, async () => {});

  finishRun(id, "older token");
  expect(operation(id).kind).toBe("stopping");
  finishRun(id, process.token);
  await closed;
  expect(operation(id).kind).toBe("idle");
  expect(Launches[id].launching).toBe(0);
  expect(progress.downloads.current).toBe(map);
  expect(recordRun(id, process, 0, true)).toBe(true);
  finishRun(id, process.token);
});
