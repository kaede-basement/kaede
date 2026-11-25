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
import { addProcessExitListener, processLifetime } from "@/lib/processes/core.ts";
import { SpawnObservers } from "@/lib/processes/spawn-process.ts";
import { launchCancelled, takeLaunchObserver } from "@/states/instance-operation.ts";
import type { ProcessHandlersType } from "@/types/application/server-process.type.ts";
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
}: MinecraftLaunchPayloadType & {
  "onClose": (instanceId: string) => void;
  "onInput": (lines: Array<string>) => void;
}): Promise<LaunchResponseType> {
  // A nested launch from the before hook may return a different child.
  const observe = takeLaunchObserver(instanceId, necessaries.statuses);

  await mkdir(necessaries.directories.instance, { "recursive": true });
  const payload: MinecraftLaunchPayloadType = { command, instanceId, necessaries };
  const beforeHooksResult: "continue" | LaunchResponseType | undefined =
    await Hooks.catchAsyncResponseHooks<LaunchResponseType>({
      "scope" : "onMinecraftLaunch",
      "toPass": payload,
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    if (beforeHooksResult.success) return beforeHooksResult;

    return { "success": false, "process": undefined };
  }

  const { directories, statuses, logPrefix } = necessaries;

  if (launchCancelled(statuses)) return { "success": false, "process": undefined };

  log.debug(
    logPrefix,
    `Spawning a Minecraft process with the '${directories.instance}' working directory`,
  );

  let exited = false;
  let child: MinecraftProcessType | undefined;
  let process: MinecraftProcessType;
  const onExit: NonNullable<ProcessHandlersType["onExit"]> = payload => {
    if (exited) return;
    exited = true;
    if (child) void notifyMinecraftExit(child);
    onClose(instanceId);
    log.warn(
      logPrefix,
      `Minecraft exited (PID ${payload.pid}, code ${payload.code}, signal ${payload.signal})`,
    );
  };

  function confirm(handle: MinecraftProcessType, startedAt?: number): void {
    if (child) return;
    child = handle;
    const lifetime = processLifetime(handle);

    observe?.(handle, startedAt ?? lifetime?.startedAt);
    if (exited) void notifyMinecraftExit(handle);
    else if (lifetime?.endedAt !== undefined) {
      onExit({ "pid": handle.pid, "code": null, "signal": null });
    } else if (lifetime) addProcessExitListener(handle.token, onExit);
  }

  SpawnObservers.set(onExit, (handle, at) => confirm(handle as MinecraftProcessType, at));
  try {
    process = await Processes.spawnProcess<MinecraftMetaType>({
      "program": { "type": "path", "value": command.java },
      "args"   : command.arguments,
      "cwd"    : directories.instance,
      "kind"   : "minecraft",
      "meta"   : { instanceId },
    }, {
      "onOutput": onInput,
      onExit,
      "onError" : payload => {
        statuses.current = LaunchStatus.Errors.UnhandledError;
        log.error(logPrefix, log.templates.json.contents(
          "Something went wrong. Payload",
          payload,
          true,
        ));
      },
    });
    confirm(process);
  } catch (error: unknown) {
    statuses.current = LaunchStatus.Errors.UnhandledError;
    log.error(logPrefix, log.templates.json.contents(
      "Failed to spawn. Payload",
      error,
      true,
    ));

    return { "success": false, "process": undefined };
  } finally {
    SpawnObservers.delete(onExit);
  }

  if (!exited && !launchCancelled(statuses)) {
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
