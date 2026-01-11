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

import { ApplicationName } from "@/constants/application.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { useApplet } from "@/lib/launcher/scopes/use-applet.ts";
import { useShell } from "@/lib/launcher/scopes/use-shell.ts";
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
  onInput,
}: {
  "command": {
    "program"  : string;
    "java"     : string;
    "arguments": Array<string>;
  };
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "onClose"    : (instanceId: string) => void;
  "onInput"    : (line: string) => void;
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

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Creating a launch command with the '${directories.instance}' working directory`,
  );

  /*
   * Every argument or word should be escaped with double quotes.
   * The java applet input arguments divide argument elements not only for spaces,
   * but for dots too (possibly other characters).
   *
   * The powershell or the provided system shell
   * might also do something with these arguments unless escaped
   */
  const escapedApplet: string = `"${command.program}" "${directories.instance}"`;
  const escapedJavaBinary: string = `"${command.java}"`;
  const escapedArguments: string = `"${command.arguments.join("\" \"")}"`;
  const passToHelpers: {
    "actualCommand": {
      "applet"   : string;
      "java"     : string;
      "arguments": string;
    };
    "instanceId" : string;
    "necessaries": PreLaunchInformationType;
    "onInput"    : (line: string) => void;
  } = {
    "actualCommand": {
      "applet"   : escapedApplet,
      "java"     : escapedJavaBinary,
      "arguments": escapedArguments,
    },
    instanceId,
    necessaries,
    onInput,
  };

  const { launchTask, process } = true
    ? await useShell(passToHelpers)
    : await useApplet(passToHelpers);

  launchTask.on("close", payload => {
    onClose(instanceId);
    log.info(
      __PRE_BUNDLED_FILENAME__,
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
      __PRE_BUNDLED_FILENAME__,
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

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftLaunch",
    "toPass": { process, command, instanceId, necessaries },
    "timing": "after",
  });

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `The '${instanceId}' successfully launched.`,
    `PID: ${process.pid}`,
  );
  statuses.current = LaunchStatus.General.Success;

  return { "success": true, process };
}
