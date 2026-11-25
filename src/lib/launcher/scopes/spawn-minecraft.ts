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

import { mkdir } from "@tauri-apps/plugin-fs";

import { LaunchStatus } from "@/constants/launcher.ts";
import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import Processes from "@/lib/processes";
import { addProcessExitListener } from "@/lib/processes/core.ts";
import type {
  LaunchResponseType,
  MinecraftLaunchPayloadType,
  MinecraftMetaType,
  MinecraftProcessType,
} from "@/types/launcher/launch/launch-response.type.ts";

import { notifyMinecraftExit } from "./minecraft-exit.ts";

export async function spawnMinecraft({
  command,
  instanceId,
  necessaries,
  onClose,
  onInput,
  onSpawn,
}: MinecraftLaunchPayloadType & {
  "onSpawn"?: (process: MinecraftProcessType, startedAt: number) => void;
  "onClose"?: (instanceId: string) => void;
  "onInput" : (lines: Array<string>) => void;
}): Promise<LaunchResponseType> {
  await mkdir(necessaries.directories.instance, { "recursive": true });
  const payload: MinecraftLaunchPayloadType = { command, instanceId, necessaries };
  const beforeHooksResult: "continue" | LaunchResponseType | undefined =
    await Hooks.catchAsyncResponseHooks<LaunchResponseType>({
      "scope" : "onMinecraftLaunch",
      "toPass": payload,
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    if (beforeHooksResult.success && beforeHooksResult.process) return beforeHooksResult;

    return { "success": false, "process": undefined };
  }

  const { directories, statuses, logPrefix } = necessaries;

  log.debug(
    logPrefix,
    `Spawning a Minecraft process with the '${directories.instance}' working directory`,
  );

  let exited = false;
  let process: MinecraftProcessType;

  try {
    process = await Processes.spawnProcess<MinecraftMetaType>({
      "program": { "type": "path", "value": command.java },
      "args"   : command.arguments,
      "cwd"    : directories.instance,
      "kind"   : "minecraft",
      "meta"   : { instanceId },
    }, {
      "onOutput": onInput,
      "onError" : payload => {
        statuses.current = LaunchStatus.Errors.UnhandledError;
        log.error(logPrefix, log.templates.json.contents(
          "Something went wrong. Payload",
          payload,
          true,
        ));
      },
    }, (child, startedAt) => {
      addProcessExitListener(child.token, payload => {
        exited = true;
        void notifyMinecraftExit(instanceId, child);
        onClose?.(instanceId);
        log.warn(
          logPrefix,
          `Minecraft exited (PID ${payload.pid}, code ${payload.code}, signal ${payload.signal})`,
        );
      });
      onSpawn?.(child, startedAt);
    });
  } catch (error: unknown) {
    statuses.current = LaunchStatus.Errors.UnhandledError;
    log.error(logPrefix, log.templates.json.contents(
      "Failed to spawn. Payload",
      error,
      true,
    ));

    return { "success": false, "process": undefined };
  }

  if (!exited) {
    await Hooks.catchAsyncVoidHooks({
      "scope" : "onMinecraftLaunch",
      "toPass": { ...payload, process },
      "timing": "after",
    });
  }

  if (exited) {
    statuses.current = LaunchStatus.Errors.UnhandledError;

    return { "success": false, "process": undefined };
  }

  log.info(logPrefix, `Successfully launched with the ${process.pid} PID`);
  statuses.current = LaunchStatus.General.Success;

  return { "success": true, process };
}
