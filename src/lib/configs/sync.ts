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

import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import FileManager from "@/lib/file-manager";
import { publishText } from "@/lib/file-manager/publish-text.ts";
import { globalStates } from "@/states/global.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

type PersistedConfig = ConfigType & Partial<Record<`config/${string}`, unknown>>;

export function projectConfig(states: PersistedConfig): PersistedConfig {
  const currentConfigStates: PersistedConfig = {
    "development": states.development,
    "extensions" : states.extensions,
    "ui"         : states.ui,
    "selected"   : states.selected,
    "locale"     : states.locale,
    "logs"       : {
      ...states.logs,
      "show": false,
      "mode": "kaede-launcher",
    },
    "java"     : states.java,
    "minecraft": states.minecraft,
  };

  for (const key of Object.keys(states)) {
    if (key.startsWith("config/")) {
      const extensionKey = key as `config/${string}`;

      currentConfigStates[extensionKey] = states[extensionKey];
    }
  }

  return currentConfigStates;
}

export function createStateSync<T extends object>(
  file: string,
  initial: () => T,
  current: () => T,
  project: (state: T) => object = state => state,
) {
  let lastWritten: string | null | undefined;
  let queued = Promise.resolve();

  async function write(): Promise<void> {
    if (lastWritten === undefined) {
      lastWritten = JSON.stringify(project(initial()), null, 2);
    }
    const contents = JSON.stringify(project(current()), null, 2);

    if (contents === lastWritten) {
      return;
    }

    const path = FileManager.join(FileManager.getBaseDirectory(), file);

    await publishText(path, contents);
    lastWritten = contents;
  }

  return (): Promise<void> => {
    const result = queued.then(write);

    queued = result.catch(() => {
      lastWritten = null;
    });

    return result;
  };
}

export const sync = createStateSync(
  FileStructure.Files.Config,
  () => GlobalInternals.initialConfig,
  () => globalStates,
  projectConfig,
);
