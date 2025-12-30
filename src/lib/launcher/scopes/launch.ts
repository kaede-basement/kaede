import { Child, Command } from "tauri-plugin-shellx-api";

import { LaunchStatus } from "@/constants/launcher.ts";
import {
  getAdditionalStartArguments,
} from "@/lib/launcher/scopes/arguments/get-additional-start-arguments.ts";
import { getClassPaths } from "@/lib/launcher/scopes/arguments/get-class-paths.ts";
import { getGameArguments } from "@/lib/launcher/scopes/arguments/get-game-arguments.ts";
import { getJavaBinary } from "@/lib/launcher/scopes/arguments/get-java-binary.ts";
import { getJvmArguments } from "@/lib/launcher/scopes/arguments/get-jvm-arguments.ts";
import {
  replaceLaunchArguments,
} from "@/lib/launcher/scopes/arguments/replace-launch-arguments.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LaunchResponseType } from "@/types/launcher/launch/launch-response.type.ts";
import type { ParsedMetaType } from "@/types/launcher/meta/parsed-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function launch({
  instanceId,
  necessaries,
  versionMeta,
  parsed,
  onClose,
}: {
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : ParsedMetaType;
  "onClose"    : (instanceId: string) => void;
}): Promise<LaunchResponseType> {
  log.debug("Entered the actual launch function");
  const { directories, statuses } = necessaries;
  const { mainClass } = parsed;

  const [
    javaBinary,
    jvmArguments,
    { "argument": classPathsArgument, classPaths },
    gameArguments,
  ]: [
    string,
    string,
    { "argument": string; "classPaths": string },
    string,
  ] = await Promise.all([
    getJavaBinary({
      instanceId,
      necessaries,
      versionMeta,
      parsed,
    }),
    getJvmArguments({
      instanceId,
      necessaries,
      versionMeta,
      parsed,
    }),
    getClassPaths({
      instanceId,
      necessaries,
      versionMeta,
      parsed,
    }),
    getGameArguments({
      instanceId,
      necessaries,
      versionMeta,
      parsed,
    }),
  ]);

  const additionalArguments: string = await getAdditionalStartArguments({
    javaBinary,
    instanceId,
    necessaries,
    versionMeta,
    parsed,
  });
  const validMainClass: string = mainClass ?? "net.minecraft.client.Minecraft";
  const toReplace: Array<string> = [
    jvmArguments,
    classPathsArgument,
    validMainClass,
    gameArguments,
  ];

  if (additionalArguments !== "") {
    toReplace.unshift(additionalArguments);
  }

  const launchArguments: string = replaceLaunchArguments({
    "auth": {
      "uuid"    : "3206b5f6-acd3-419e-a297-7d120f510767",
      "token"   : "huh",
      "username": "windstone_",
      "type"    : "msa",
    },
    "builtLaunchArguments": {
      "toReplace": toReplace.join(" "),
      classPaths,
    },
    instanceId,
    necessaries,
    versionMeta,
    parsed,
  });
  const instanceCommand = Command.create(
    javaBinary,
    launchArguments,
    { "cwd": directories.instance },
  );
  console.log(launchArguments);

  log.debug(`Launching the '${instanceId}' instance`);
  const process: Child = await instanceCommand.spawn();

  log.debug(`Adding listeners to the '${instanceId}' instance process`);
  instanceCommand.stdout.on("data", line => {
    console.log(line);
  });
  instanceCommand.on("close", payload => {
    log.info(
      `The '${instanceId}' was closed. Payload:`,
      "\n" + JSON.stringify(payload, null, 2),
    );
    onClose(instanceId);
  });
  instanceCommand.on("error", payload => {
    log.error(
      `Something went wrong with the '${instanceId}' instance. Payload:`,
      "\n" + JSON.stringify(payload, null, 2),
    );
    statuses.current = LaunchStatus.Errors.UnhandledError;
  });

  log.info(`The '${instanceId}' successfully launched`);
  statuses.current = LaunchStatus.General.Success;

  return { "success": true, process };
}
