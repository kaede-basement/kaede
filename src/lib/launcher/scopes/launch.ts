import { Child, Command } from "tauri-plugin-shellx-api";

import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
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
  log.debug(__PRE_BUNDLED_FILENAME__, "Entered the actual launch function");
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
    javaBinary,
  });

  const beforeHooksResult: "continue" | void | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<void>({
      "scope" : "onMinecraftLaunch",
      "toPass": {
        "command": [
          javaBinary,
          launchArguments,
        ],
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
        javaBinary,
      },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue") {
    return {
      "success": true,
      "process": undefined,
    };
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Creating a launch command with the '${directories.instance}' working directory`,
  );
  const instanceCommand = Command.create(
    javaBinary,
    launchArguments,
    { "cwd": directories.instance },
  );

  log.debug(__PRE_BUNDLED_FILENAME__, `Launching the '${instanceId}' instance`);
  const process: Child = await instanceCommand.spawn();

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftLaunch",
    "toPass": {
      process,
      "command": [
        javaBinary,
        launchArguments,
      ],
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
      javaBinary,
    },
    "timing": "before",
  });

  log.debug(__PRE_BUNDLED_FILENAME__, `Adding listeners to the '${instanceId}' instance process`);
  instanceCommand.on("close", payload => {
    log.info(
      __PRE_BUNDLED_FILENAME__,
      `The '${instanceId}' was closed. Payload:`,
      "\n" + JSON.stringify(payload, null, 2),
    );
    onClose(instanceId);
  });
  instanceCommand.on("error", payload => {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Something went wrong with the '${instanceId}' instance. Payload:`,
      "\n" + JSON.stringify(payload, null, 2),
    );
    statuses.current = LaunchStatus.Errors.UnhandledError;
  });

  log.info(__PRE_BUNDLED_FILENAME__, `The '${instanceId}' successfully launched`);
  statuses.current = LaunchStatus.General.Success;

  return { "success": true, process };
}
