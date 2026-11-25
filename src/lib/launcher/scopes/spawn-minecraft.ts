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
import type {
  LaunchResponseType,
  MinecraftMetaType,
  MinecraftProcessType,
} from "@/types/launcher/launch/launch-response.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

import { launchAttempts } from "./fetching/download-outcome.ts";

export async function spawnMinecraft({
  command,
  instanceId,
  necessaries,
  onClose,
  onInput,
}: {
  "command": {
    "java"     : string;
    "arguments": Array<string>;
  };
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "onClose"    : (instanceId: string) => void;
  "onInput"    : (lines: Array<string>) => void;
}): Promise<LaunchResponseType & { "reason"?: "cancelled" }> {
  await mkdir(necessaries.directories.instance, { "recursive": true });
  const beforeHooksResult: "continue" | LaunchResponseType | undefined =
    await Hooks.catchAsyncResponseHooks<LaunchResponseType>({
      "scope" : "onMinecraftLaunch",
      "toPass": { command, instanceId, necessaries },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses, logPrefix } = necessaries;

  log.debug(
    logPrefix,
    `Spawning a Minecraft process with the '${directories.instance}' working directory`,
  );

  let exited = false;
  let process: MinecraftProcessType;

  if (launchAttempts.get(statuses)?.stop) {
    return { "success": false, "process": undefined, "reason": "cancelled" };
  }
  try {
    process = await Processes.spawnProcess<MinecraftMetaType>({
      "program": { "type": "path", "value": command.java },
      "args"   : command.arguments,
      "cwd"    : directories.instance,
      "kind"   : "minecraft",
      "meta"   : { instanceId },
    }, {
      "onOutput": onInput,
      "onExit"  : payload => {
        exited = true;
        onClose(instanceId);
        log.warn(
          logPrefix,
          `Minecraft exited (PID ${payload.pid}, code ${payload.code}, signal ${payload.signal})`,
        );
        void Hooks.catchAsyncVoidHooks({
          "scope" : "onMinecraftKill",
          "toPass": payload.pid,
          "timing": "after",
        });
      },
      "onError": payload => {
        statuses.current = LaunchStatus.Errors.UnhandledError;
        log.error(logPrefix, log.templates.json.contents(
          "Something went wrong. Payload",
          payload,
          true,
        ));
        void Hooks.catchAsyncVoidHooks({
          "scope" : "onMinecraftKill",
          "toPass": payload.pid,
          "timing": "after",
        });
      },
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

  if (!exited && !launchAttempts.get(statuses)?.stop) {
    await Hooks.catchAsyncVoidHooks({
      "scope" : "onMinecraftLaunch",
      "toPass": { process, command, instanceId, necessaries },
      "timing": "after",
    });
  }

  if (launchAttempts.get(statuses)?.stop) {
    if (!exited) {
      await process.kill();
    }

    return { "success": false, "process": undefined, "reason": "cancelled" };
  }
  if (exited) {
    statuses.current = LaunchStatus.Errors.UnhandledError;

    return { "success": false, "process": undefined };
  }

  log.info(logPrefix, `Successfully launched with the ${process.pid} PID`);
  statuses.current = LaunchStatus.General.Success;

  return { "success": true, process };
}
