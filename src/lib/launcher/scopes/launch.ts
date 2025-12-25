import { type Platform, platform } from "@tauri-apps/plugin-os";
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
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { DirectoriesType } from "@/types/launcher/launch/directories.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export async function launch({
  instanceId,
  instance,
  versionMeta,
  statuses,
  directories,
}: {
  "instanceId" : string;
  "instance"   : InstanceStateType;
  "versionMeta": MetaMinecraftVersionType;
  "statuses"   : LauncherStatusesType;
  "directories": DirectoriesType;
}): Promise<boolean> {
  const currentPlatform: Platform = platform();
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
    getJavaBinary({ currentPlatform }),
    getClassPaths({
      currentPlatform,
      versionMeta,
      directories,
    }),
    getJvmArguments({
      instance,
      currentPlatform,
      versionMeta,
      directories,
    }),
    getGameArguments({
      currentPlatform,
      versionMeta,
      directories,
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
    "builtLaunchArguments": {
      toReplace,
      classPaths,
    },
    instance,
    versionMeta,
    directories,
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
