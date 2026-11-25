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
import { toRaw } from "vue";

import { log } from "@/lib/logging/log.ts";
import type {
  DownloadReportType,
  DownloadSnapshotType,
} from "@/types/launcher/artifacts/download.type.ts";
import type {
  LauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";

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

  type ProgressMap = LauncherStatusesType["downloads"]["current"];
  const writtenEntries = new Map<string, { "map": ProgressMap; "tuple": [number, number] }>;

  function deleteOwned(path: string, map: ProgressMap, tuple: [number, number]): void {
    if (toRaw(map).get(path) === toRaw(tuple)) {
      map.delete(path);
    }
    writtenEntries.delete(path);
  }

  const applySnapshotData = (success: number, failed: number): void => {
    if (success < previousSuccess || failed < previousFailed) {
      return;
    }

    statuses.downloads.success = statuses.downloads.success + success - previousSuccess;
    statuses.downloads.failed  = statuses.downloads.failed + failed - previousFailed;

    previousSuccess = success;
    previousFailed  = failed;
  };

  let finished = false;

  // eslint-disable-next-line unicorn/prefer-add-event-listener
  onProgress.onmessage = (snapshot: DownloadSnapshotType): void => {
    if (finished) {
      return;
    }
    const current = statuses.downloads.current;

    for (const [path, { map, tuple }] of writtenEntries) {
      if (map !== current || !(path in snapshot.current)) {
        deleteOwned(path, map, tuple);
      }
    }

    for (const [path, fileProgress] of Object.entries(snapshot.current)) {
      /*
       * 'fileProgress' is '[progress, speed]',
       * where 'progress' is accumulated while 'speed' is not
       */
      current.set(path, fileProgress);
      writtenEntries.set(path, { "map": current, "tuple": fileProgress });
    }

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
    for (const [path, { map, tuple }] of writtenEntries) {
      deleteOwned(path, map, tuple);
    }
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
