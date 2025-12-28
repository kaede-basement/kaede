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
import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function launch({
  instanceId,
  necessaries,
  versionMeta,
  parsed,
}: {
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : {
    "libraries": Array<MappedArtifactType>;
    "natives"  : Array<MappedArtifactType>;
    "logging"  : (MappedArtifactType & {
      "argument": string;
    }) | false;
    "client"   : MappedArtifactType;
    "patches"  : LibraryArtifactsType;
    "mainClass": string;
  };
}): Promise<boolean> {
  const { directories, statuses } = necessaries;
  const { mainClass } = parsed;

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
    getJavaBinary({
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
    getJvmArguments({
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
  const toReplace: Array<string> = [
    classPathsArgument,
    jvmArguments,
    mainClass,
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

  instanceCommand.stdout.on("data", line => {
    console.log(line);
  });
  instanceCommand.stderr.on("data", line => {
    statuses.current = LaunchStatus.Errors.UnhandledError;

    console.error(line);
  });

  log.debug(`Launching the '${instanceId}' instance`);
  await instanceCommand.spawn();

  log.info(`The '${instanceId}' successfully launched`);
  statuses.current = LaunchStatus.General.Success;

  return true;
}
