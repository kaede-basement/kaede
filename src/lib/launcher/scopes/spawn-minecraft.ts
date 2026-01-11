import { Child, Command, makePowershellScript } from "tauri-plugin-shellx-api";

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
  const escapedApplet: string = `"${command.program}" "${directories.instance}" "${command.java}"`;
  const escapedArguments: string = `"${command.arguments.join("\" \"")}"`;
  const launchTask: Command<string> = necessaries.platform === "windows"
    ? makePowershellScript(
      `javaw -jar ${escapedApplet} ${escapedArguments}`,
    )
    : Command.create(
      "javaw",
      `-jar ${escapedApplet} ${escapedArguments}`,
    );

  log.debug(__PRE_BUNDLED_FILENAME__, `Launching the '${instanceId}' instance`);
  const process: Child = await launchTask.spawn();

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftLaunch",
    "toPass": { process, command, instanceId, necessaries },
    "timing": "after",
  });

  log.debug(__PRE_BUNDLED_FILENAME__, "Creating a function to handle actual PID extraction");
  const handlePID = (line: string): void => {
    /*
     * TODO: handle the Minecraft instance killing more properly
     *
     * For some reason, the 'INFO'-leveled log messages in the Java applet
     * go into the 'stderr'. Another thing to note is that the provided by Tauri PID points
     * to what seems to be an intermediate process that no longer exists.
     *
     * To provide a way to kill the Minecraft instance, we need to handle these limitations,
     * so in the Java applet I used a workaround to get the actual PID:
     * refer to https://stackoverflow.com/a/7690178
     *
     * I also thought about writing to the process stdin with the keyword
     * for killing the Minecraft process, but it seems like only the 'stderr' and 'stdout'
     * are properly working here.
     */
    if (line.includes("__java_applet_pid_workaround_")) {
      log.debug(
        `${__PRE_BUNDLED_FILENAME__}:${instanceId}`,
        "Trying to extract an actual process PID",
      );
      const elements: Array<string> = line.split("_");
      const pidString: string | undefined = elements.pop();

      if (!pidString) {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          "The workaround for the java applet was found, but no PID was extracted.",
          `The actual line: ${line}`,
        );

        return;
      }

      const pid: number = Number(pidString);

      if (Number.isNaN(pid)) {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          "The workaround for the java applet was found, but the extracted PID is not a number.",
          `The extracted PID: ${pidString}; the actual line: ${line}`,
        );

        return;
      }

      log.info(__PRE_BUNDLED_FILENAME__, `Extracted the actual PID: ${pid}`);

      // Overwrite the stored PID to the actual PID
      process.pid = pid;

      /*
       * Calling 'includes' on every string line is expensive;
       * that is why we unregister a function aimed at getting PID
       * and instead register a specialized function that handles error logs
       */
      launchTask.stderr.off("data", handlePID);
      launchTask.stderr.on("data", onInput);
    }
  };

  log.debug(__PRE_BUNDLED_FILENAME__, `Adding listeners to the '${instanceId}' instance process`);
  launchTask.stdout.on("data", onInput);
  launchTask.stderr.on("data", handlePID);
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

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `The '${instanceId}' successfully launched.`,
    `PID: ${process.pid}`,
  );
  statuses.current = LaunchStatus.General.Success;

  return { "success": true, process };
}
