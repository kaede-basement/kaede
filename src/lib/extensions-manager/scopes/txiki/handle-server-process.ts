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

import { Command } from "tauri-plugin-shellx-api";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import { serverProcesses } from "@/states/servers.ts";

export async function handleServerProcess(command: Command<string>, name: string): Promise<void> {
  command.stdout.on("data", data => {
    log.debug(__PRE_BUNDLED_FILENAME__, "Received data for a txiki server:" + "\n", data);
  });
  command.stderr.on("data", data => {
    log.error(__PRE_BUNDLED_FILENAME__, "Received an error for a txiki server:" + "\n", data);
  });
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