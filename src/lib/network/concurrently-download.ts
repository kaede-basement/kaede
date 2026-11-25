/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Channel, invoke } from "@tauri-apps/api/core";

import { log } from "@/lib/logging/log.ts";
import { notifyDownloadProgress, ObservableDownloadMap } from "@/lib/network/download-progress.ts";
import type {
  DownloadReportType,
  DownloadSnapshotType,
} from "@/types/launcher/artifacts/download.type.ts";
import type {
  LauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";

type Progress = [number, number];
const ownersByMap = new WeakMap<Map<string, Progress>, Map<string, Map<symbol, Progress>>>;

export async function concurrentlyDownload({
  concurrency,
  entries,
  statuses,
  label,
  cancelId = `${Math.random()}`,
  debug = false,
}: {
  "concurrency": number;
  "entries"    : Array<{ "url": string; "path": string }>;
  "statuses"   : LauncherStatusesType;
  "label"      : string;
  "cancelId"  ?: string;
  "debug"     ?: boolean;
}): Promise<DownloadReportType> {
  const logPrefix: string = `${label}:${__PRE_BUNDLED_FILENAME__}`;

  log.debug(logPrefix, `Removing duplicates for ${entries.length} objects`);
  const uniqueMap: Map<string, string> = new Map(
    // It is probably better to filter by unique paths rather than unique URLs...
    entries.map(({ url, path }) => [path, url]),
  );
  const uniqueArtifacts: Array<{ "url": string; "path": string }> = [];

  for (const [path, url] of uniqueMap.entries()) {
    uniqueArtifacts.push({ url, path });
  }

  log.debug(
    logPrefix,
    `Removed ${entries.length - uniqueArtifacts.length}/${entries.length} duplicates`,
  );

  log.debug(
    logPrefix,
    `Starting to download ${uniqueArtifacts.length}/${entries.length} objects`,
  );
  statuses.downloads.total = statuses.downloads.total + uniqueArtifacts.length;

  const onProgress = new Channel<DownloadSnapshotType>;

  /*
   * Snapshot data are cumulative, and since 'concurrentlyDownload'
   * might be called more than once at a time, we need to handle proper merging of statuses
   */
  let previousSuccess: number = 0;
  let previousFailed : number = 0;
  const previousPaths = new Set<string>;
  const batch = Symbol();
  const current = statuses.downloads.current;
  const ownersByPath = ownersByMap.get(current) ?? new Map<string, Map<symbol, Progress>>;

  ownersByMap.set(current, ownersByPath);

  const applySnapshotData = (success: number, failed: number): void => {
    if (success < previousSuccess || failed < previousFailed) {
      return;
    }

    statuses.downloads.success = statuses.downloads.success + success - previousSuccess;
    statuses.downloads.failed  = statuses.downloads.failed + failed - previousFailed;

    previousSuccess = success;
    previousFailed  = failed;
  };

  function publishCurrent(snapshot: DownloadSnapshotType["current"]): void {
    let changed = false;

    for (const path of previousPaths) {
      if (!Object.prototype.hasOwnProperty.call(snapshot, path)) {
        const pathOwners = ownersByPath.get(path)!;

        pathOwners.delete(batch);
        const remaining = pathOwners.values().next();

        if (remaining.done) {
          ownersByPath.delete(path);
          current.delete(path);
        } else {
          current.set(path, remaining.value);
        }
        changed = true;
        previousPaths.delete(path);
      }
    }
    for (const [path, progress] of Object.entries(snapshot)) {
      let pathOwners = ownersByPath.get(path);

      if (!pathOwners) {
        pathOwners = new Map;
        ownersByPath.set(path, pathOwners);
      }
      pathOwners.set(batch, progress);
      const old = current.get(path);

      if (!old || old[0] !== progress[0] || old[1] !== progress[1]) {
        current.set(path, progress);
        changed = true;
      }
      previousPaths.add(path);
    }
    if (changed && !(current instanceof ObservableDownloadMap)) {
      notifyDownloadProgress(current);
    }
  }

  let finished = false;

  // eslint-disable-next-line unicorn/prefer-add-event-listener
  onProgress.onmessage = (snapshot: DownloadSnapshotType): void => {
    if (finished) {
      return;
    }
    publishCurrent(snapshot.current);
    applySnapshotData(snapshot.success, snapshot.failed);
  };

  const report = await invoke<DownloadReportType>("concurrently_download", {
    "entries": uniqueArtifacts,
    concurrency,
    label,
    onProgress,
    cancelId,
    debug,
  }).finally(() => {
    finished = true;
    publishCurrent({});
  });

  applySnapshotData(report.success, report.failed);

  if (report.cancelled) {
    log.info(logPrefix, "The Minecraft download tasks were cancelled");
    statuses.downloads.total = statuses.downloads.total - (
      uniqueArtifacts.length - report.success - report.failed
    );
  }

  return report;
}
