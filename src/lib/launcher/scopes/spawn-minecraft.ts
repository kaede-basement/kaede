import { resolveResource } from "@tauri-apps/api/path";
import { Child, Command } from "tauri-plugin-shellx-api";

import { ApplicationName, ResourceLauncher } from "@/constants/application.ts";
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
    "java"     : string;
    "arguments": Array<string>;
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

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Creating a launch command with the '${directories.instance}' working directory`,
  );

  console.log(`/C java -jar "${command.program}" "${directories.instance}" "${command.java}" "${command.arguments.join("\" \"")}"`);

  return;

  const launchTask = Command.create(
    "cmd",
    `/C java -jar ${launcherJar} "${directories.instance}" "java" "${command.arguments.join("\" \"")}"`,
  );

  log.debug(__PRE_BUNDLED_FILENAME__, `Launching the '${instanceId}' instance`);
  const process: Child = await launchTask.spawn();

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftLaunch",
    "toPass": { process, command, instanceId, necessaries },
    "timing": "after",
  });

  log.debug(__PRE_BUNDLED_FILENAME__, `Adding listeners to the '${instanceId}' instance process`);
  launchTask.stdout.on("data", data => {
    console.log(data);
  });
  launchTask.stderr.on("data", data => {
    console.log(data);
  });
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

  log.info(__PRE_BUNDLED_FILENAME__, `The '${instanceId}' successfully launched`);
  statuses.current = LaunchStatus.General.Success;

  return { "success": true, process };
}
