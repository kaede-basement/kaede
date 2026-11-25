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

import { retryCancellationOnProgress } from "@/lib/launcher/scopes/fetching/cancel-all.ts";
import { launchAttempts } from "@/lib/launcher/scopes/fetching/download-outcome.ts";
import { log } from "@/lib/logging/log.ts";
import type {
  DownloadEntryType,
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
  "entries"    : Array<DownloadEntryType>;
  "statuses"   : LauncherStatusesType;
  "label"      : string;
  "cancelId"  ?: string;
  "debug"     ?: boolean;
}): Promise<DownloadReportType> {
  const signal = launchAttempts.get(statuses)?.signal;

  if (signal?.aborted) {
    return { "cancelled": true, "success": 0, "failed": 0, "failures": [] };
  }
  const logPrefix: string = `${label}:${__PRE_BUNDLED_FILENAME__}`;

  log.debug(logPrefix, `Removing duplicates for ${entries.length} objects`);
  const uniqueMap = (new Map<string, DownloadEntryType>);

  for (const entry of entries) {
    const previous = uniqueMap.get(entry.path);

    if (previous && (
      previous.url !== entry.url || previous.size !== entry.size ||
      previous.algorithm !== entry.algorithm ||
      previous.hash?.toLowerCase() !== entry.hash?.toLowerCase()
    )) {
      throw new Error(`Conflicting download expectations for ${entry.path}`);
    }
    uniqueMap.set(entry.path, entry);
  }
  const uniqueArtifacts = [...uniqueMap.values()];

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
  let previousPaths  : Set<string> = new Set;

  const applySnapshotData = (success: number, failed: number): void => {
    if (success < previousSuccess || failed < previousFailed) {
      return;
    }

    statuses.downloads.success = statuses.downloads.success + success - previousSuccess;
    statuses.downloads.failed  = statuses.downloads.failed + failed - previousFailed;

    previousSuccess = success;
    previousFailed  = failed;
  };

  const retryCancellation = retryCancellationOnProgress(signal, cancelId);
  let active = true;

  // eslint-disable-next-line unicorn/prefer-add-event-listener
  onProgress.onmessage = (snapshot: DownloadSnapshotType): void => {
    if (!active) return;
    retryCancellation();
    const current = statuses.downloads.current;

    for (const path of previousPaths) {
      // If the path is missing, then the download task for this path was finished
      if (!(path in snapshot.current)) {
        current.delete(path);
      }
    }

    previousPaths = new Set;

    for (const [path, fileProgress] of Object.entries(snapshot.current)) {
      /*
       * 'fileProgress' is '[progress, speed]',
       * where 'progress' is accumulated while 'speed' is not
       */
      current.set(path, fileProgress);
      previousPaths.add(path);
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
    active = false;
  });

  applySnapshotData(report.success, report.failed);

  for (const path of previousPaths) {
    statuses.downloads.current.delete(path);
  }

  previousPaths = new Set;

  if (report.cancelled) {
    log.info(logPrefix, "The Minecraft download tasks were cancelled");
    statuses.downloads.total = statuses.downloads.total - (
      uniqueArtifacts.length - report.success - report.failed
    );
  }

  return report;
}
