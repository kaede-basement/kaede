import type { Channel } from "@tauri-apps/api/core";
import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, test } from "bun:test";
import { markRaw } from "vue";

import type { DownloadSnapshotType } from "@/types/launcher/artifacts/download.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

import { concurrentlyDownload } from "./concurrently-download.ts";

test("settled downloads ignore late snapshots after success or failure", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": { crypto } });
  try {
    for (const reject of [false, true]) {
      const statuses: LauncherStatusesType = {
        "instanceId": "id",
        "launching" : 0,
        "current"   : undefined,
        "downloads" : { "current": markRaw(new Map), "total": 0, "failed": 0, "success": 0 },
      };
      let channel!: Channel<DownloadSnapshotType>;
      const snapshot: DownloadSnapshotType = {
        "current": { "asset": [50, 100] }, "success": 0, "failed": 0,
      };

      mockIPC((_, payload) => {
        channel = (payload as { "onProgress": Channel<DownloadSnapshotType> }).onProgress;
        channel.onmessage(snapshot);
        expect(statuses.downloads.current.has("asset")).toBe(true);
        if (reject) {
          throw new Error("download failed");
        }

        return { "success": 1, "failed": 0, "cancelled": false, "failures": [] };
      });
      const result = concurrentlyDownload({
        "concurrency": 1, "label"      : "test", statuses,
        "entries"    : [{ "path": "asset", "url": "test" }],
      });

      await (reject ? expect(result).rejects.toThrow("download failed") : result);
      channel.onmessage(snapshot);
      expect(statuses.downloads.current.size).toBe(0);
    }
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "window", previous);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
