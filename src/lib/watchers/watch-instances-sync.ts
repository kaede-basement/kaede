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

import { useDebounceFn } from "@vueuse/core";
import { watch } from "vue";

import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import { instanceStates, restorePlaytime } from "@/states/instance.ts";

function write(): Promise<void> {
  return Instances.sync().catch(error => {
    log.error(__PRE_BUNDLED_FILENAME__, "Failed to sync instance metadata:", error);
  });
}

/**
 * Updates instances file on any instance states changes.
 */
export function watchInstancesSync(): () => void {
  const debouncedWrite = useDebounceFn(write, 300);

  if (restorePlaytime()) {
    void write();
  }

  return watch(
    () => instanceStates,
    debouncedWrite,
    { "deep": true },
  );
}
