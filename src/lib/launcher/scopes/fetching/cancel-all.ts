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

import { invoke } from "@tauri-apps/api/core";

import { cancelWithFeedback } from "@/lib/network/cancel-with-feedback.ts";
import { hasActiveDownloads } from "@/lib/network/native-download.ts";

export function cancelAll(cancelId: string): Promise<boolean> {
  return invoke<boolean>("cancel_downloads", { cancelId });
}

// The first cancellation IPC can reach Rust before the batch registers.
export function retryCancellationOnProgress(
  signal: AbortSignal | undefined, cancelId: string,
): () => void {
  let retried = false;

  return (): void => {
    if (signal?.aborted && !retried) {
      retried = true;
      void cancelWithFeedback(() => cancelAll(cancelId), () => hasActiveDownloads(cancelId));
    }
  };
}
