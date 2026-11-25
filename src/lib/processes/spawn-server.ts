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

import { log } from "@/lib/logging/log.ts";
import { hydrate } from "@/lib/processes/hydrate.ts";
import { spawnProcess } from "@/lib/processes/spawn-process.ts";
import { watchProcesses } from "@/lib/watchers/watch-processes.ts";
import { serverProcesses } from "@/states/servers.ts";
import type {
  ProgramSpecType,
  ServerMetaType,
  ServerProcessType,
} from "@/types/application/server-process.type.ts";

export async function spawnServer({ name, program, args, port }: {
  "name"   : string;
  "program": ProgramSpecType;
  "args"   : Array<string>;
  "port"   : number;
}): Promise<ServerProcessType> {
  await watchProcesses();
  let exited = false;
  const handle = await spawnProcess<ServerMetaType>({
    program, args,
    "kind": "extension-server",
    "meta": { name, port },
  }, {
    "onOutput": (lines, stream) => (stream === "stdout" ? log.debug : log.error)(
      __PRE_BUNDLED_FILENAME__, `${name} server output:\n`, lines.join("\n"),
    ),
    "onExit": ({ token }) => {
      exited = true;
      serverProcesses.value = serverProcesses.value.filter(item => item.token !== token);
    },
  });

  if (exited) {
    throw new Error(`Server '${name}' exited during startup (PID ${handle.pid})`);
  }

  const server = hydrate(handle);

  serverProcesses.value = [...serverProcesses.value, server];

  return server;
}
