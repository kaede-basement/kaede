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

import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Command } from "tauri-plugin-shellx-api";

import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import { serverProcesses } from "@/states/servers.ts";

export async function serveCode(name: string, code: string): Promise<void> {
  const filePath: string = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Folders.Extensions.Path,
    `${name}-${Date.now()}.txiki`,
  );

  try {
    log.debug(__PRE_BUNDLED_FILENAME__, "Writing code contents to host txiki");
    await writeTextFile(filePath, code);
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to create a code file to host txiki:",
      Errors.prettify(error),
    );

    return;
  }

  const command: Command<string> = Command.sidecar("txiki-server", [
    "serve",
    filePath,
  ]);

  command.on("close", () => {
    GlobalInternals.serverProcesses = GlobalInternals
      .serverProcesses
      .filter(item => item.name !== name);
    serverProcesses.value = [...GlobalInternals.serverProcesses];
  });

  GlobalInternals.serverProcesses.push({
    "name" : name,
    "value": await command.spawn(),
  });
  serverProcesses.value = [...GlobalInternals.serverProcesses];
}