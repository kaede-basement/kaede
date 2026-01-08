/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026 windstone <notwindstone@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { Child, Command } from "tauri-plugin-shellx-api";

import { ApplicationName } from "@/constants/application.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LaunchResponseType } from "@/types/launcher/launch/launch-response.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function spawnMinecraft({
  command,
  instanceId,
  necessaries,
  onClose,
}: {
  "command": {
    "program"  : string;
    "arguments": string;
  };
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "onClose"    : (instanceId: string) => void;
}): Promise<LaunchResponseType> {
  const beforeHooksResult: "continue" | LaunchResponseType | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<LaunchResponseType>({
      "scope" : "onMinecraftLaunch",
      "toPass": { command, instanceId, necessaries },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses } = necessaries;

  log.debug(`Creating a launch command with the '${directories.instance}' working directory`);
  const launchTask = Command.create(
    command.program,
    command.arguments,
    { "cwd": directories.instance },
  );

  log.debug(`Launching the '${instanceId}' instance`);
  const process: Child = await launchTask.spawn();

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftLaunch",
    "toPass": { process, command, instanceId, necessaries },
    "timing": "after",
  });

  log.debug(`Adding listeners to the '${instanceId}' instance process`);
  launchTask.on("close", payload => {
    onClose(instanceId);
    log.info(
      `The '${instanceId}' was closed.`,
      `Payload (everything ${ApplicationName} has):`,
      "\n" + JSON.stringify(payload, null, 2),
    );
    ExtensionsManager.catchAsyncVoidHooks({
      "scope" : "onMinecraftKill",
      "toPass": process.pid,
      "timing": "after",
    });
  });
  launchTask.on("error", payload => {
    statuses.current = LaunchStatus.Errors.UnhandledError;

    log.error(
      `Something went wrong with the '${instanceId}' instance.`,
      `Payload (everything ${ApplicationName} has):`,
      "\n" + JSON.stringify(payload, null, 2),
    );
    ExtensionsManager.catchAsyncVoidHooks({
      "scope" : "onMinecraftKill",
      "toPass": process.pid,
      "timing": "after",
    });
  });

  log.info(`The '${instanceId}' successfully launched`);
  statuses.current = LaunchStatus.General.Success;

  return { "success": true, process };
}
