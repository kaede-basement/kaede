import "@/extendable/global-object.ts";

import type { Channel, InvokeArgs } from "@tauri-apps/api/core";
import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, mock, test } from "bun:test";

import { beginLaunchAttempt } from "@/lib/launcher/scopes/fetching/download-outcome.ts";
import { cancelLaunchDownloads } from "@/lib/launcher/scopes/handle-launch.ts";
import { concurrentlyDownload } from "@/lib/network/concurrently-download.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

import { useUiState } from "./ui-state.ts";

useUiState();

test("Stop skips new batches and retries cancellation on late native registration", async () => {
  const statuses = {
    "instanceId": "game",
    "downloads" : { "current": new Map, "total": 0, "success": 0, "failed": 0 },
  } as LauncherStatusesType;

  beginLaunchAttempt(statuses);
  const finish = Promise.withResolvers<void>();
  const cancel = mock(() => false);
  const report = { "cancelled": true, "success": 0, "failed": 0, "failures": [] };
  let progress!: () => void;
  const invoke = mock(async (cmd: string, arguments_?: InvokeArgs) => {
    if (cmd === "cancel_downloads") return cancel();
    const { onProgress } = arguments_ as { "onProgress": Channel<unknown> };

    progress = (): void => onProgress.onmessage({ "current": {}, "success": 0, "failed": 0 });
    await finish.promise;

    return report;
  });

  mockIPC(invoke);
  const options = {
    statuses, "cancelId"   : "game-download", "concurrency": 1, "label"      : "client",
    "entries"    : [{ "url": "https://example.org/file", "path": "/game/file" }],
  };
  const batch = concurrentlyDownload(options);

  await cancelLaunchDownloads(statuses);
  expect(cancel).toHaveBeenCalledTimes(1);
  progress();
  progress();
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(await concurrentlyDownload(options)).toEqual(report);
  finish.resolve();
  expect(await batch).toEqual(report);
  expect(invoke.mock.calls.filter(([cmd]) => cmd === "concurrently_download")).toHaveLength(1);
});

function startBatch(state: LauncherStatusesType): ReturnType<typeof concurrentlyDownload> {
  beginLaunchAttempt(state);

  return concurrentlyDownload({
    "statuses"   : state, "concurrency": 1, "label"      : "client",
    "entries"    : [{ "url": "https://example.org/file", "path": "/game/file" }],
  });
}

test("a delayed Stop cannot reach a later batch for the same instance", async () => {
  const statuses = (): LauncherStatusesType => ({
    "instanceId": "game",
    "downloads" : { "current": new Map, "total": 0, "success": 0, "failed": 0 },
  } as LauncherStatusesType);
  const pending = (new Map<string, () => void>);
  const ids: string[] = [];
  const release = Promise.withResolvers<void>();

  mockIPC(async (cmd, data) => {
    const { cancelId } = data as { "cancelId": string };

    if (cmd === "cancel_downloads") {
      await release.promise;
      pending.get(cancelId)?.();

      return pending.has(cancelId);
    }
    ids.push(cancelId);
    await new Promise<void>(resolve => pending.set(cancelId, resolve));
    pending.delete(cancelId);

    return { "success": 1, "failed": 0, "cancelled": false, "failures": [] };
  });
  const first = statuses();
  const download = startBatch(first);
  const stop = cancelLaunchDownloads(first);

  pending.get(ids[0])!();
  await download;
  const next = startBatch(statuses());

  release.resolve();
  expect(await stop).toBe(false);
  expect(ids[0]).not.toBe(ids[1]);
  expect(pending.has(ids[1])).toBe(true);
  pending.get(ids[1])!();
  await next;
});
