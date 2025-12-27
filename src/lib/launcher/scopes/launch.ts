import { Command } from "@tauri-apps/plugin-shell";

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
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function launch({
  instanceId,
  client,
  necessaries,
  versionMeta,
}: {
  "instanceId" : string;
  "client"     : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<boolean> {
  const { directories, statuses } = necessaries;

  const mainClass = versionMeta.mainClass;
  const [
    javaBinary,
    { "argument": classPathsArgument, classPaths },
    jvmArguments,
    gameArguments,
  ]: [
    "java" | "cmd",
    { "argument": string; "classPaths": string },
    string,
    string,
  ] = await Promise.all([
    getJavaBinary({ necessaries, versionMeta }),
    getClassPaths({
      necessaries,
      versionMeta,
      client,
    }),
    getJvmArguments({
      necessaries,
      versionMeta,
      client,
    }),
    getGameArguments({
      necessaries,
      versionMeta,
      client,
    }),
  ]);

  const additionalArguments: string = getAdditionalStartArguments({ javaBinary });
  const toReplace: string = [
    additionalArguments,
    classPathsArgument,
    jvmArguments,
    mainClass,
    gameArguments,
  ].join(" ");
  const launchArguments: string = replaceLaunchArguments({
    "auth": {
      "uuid"    : "",
      "token"   : "",
      "username": "",
    },
    "builtLaunchArguments": {
      toReplace,
      classPaths,
    },
    client,
    necessaries,
    versionMeta,
  });
  const instanceCommand = Command.create(
    javaBinary,
    launchArguments,
    { "cwd": directories.instance },
  );
  console.log(launchArguments);

  instanceCommand.stdout.on("data", line => {
    console.log(line);
  });
  instanceCommand.stderr.on("data", line => {
    console.error(line);
  });

  log.debug(`Launching the '${instanceId}' instance`);
  await instanceCommand.spawn();

  log.info(`The '${instanceId}' successfully launched`);
  statuses.add(LaunchStatus.General.Success);

  return true;
}
