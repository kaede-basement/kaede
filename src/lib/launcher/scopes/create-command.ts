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

import { resolveResource } from "@tauri-apps/api/path";

import { ResourceLauncher } from "@/constants/application.ts";
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
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function createCommand({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<{
  "program"  : string;
  "java"     : string;
  "arguments": Array<string>;
}> {
  const [
    // Minecraft will be launched inside a Java applet
    launcherJar,
    javaBinary,
    jvmArguments,
    { "argument": classPathsArgument, classPaths },
    gameArguments,
    additionalArguments,
  ]: [
    string,
    string,
    Array<string>,
    { "argument": [string, string]; "classPaths": string },
    Array<string>,
    Array<string>,
  ] = await Promise.all([
    resolveResource(ResourceLauncher),
    getJavaBinary({ necessaries, finalizedPatch }),
    getJvmArguments({ necessaries, finalizedPatch }),
    getClassPaths({ necessaries, finalizedPatch }),
    getGameArguments({ necessaries, finalizedPatch }),
    getAdditionalStartArguments({ necessaries, finalizedPatch }),
  ]);

  const toReplace: Array<string> = [
    ...additionalArguments,
    ...jvmArguments,
    ...classPathsArgument,
    finalizedPatch.mainClass,
    ...gameArguments,
  ];

  const launchArguments: Array<string> = replaceLaunchArguments({
    "auth": {
      "uuid"    : "3206b5f6acd3419ea2977d120f510767",
      "token"   : "none",
      "username": "windstone_",
      "type"    : "msa",
    },
    "builtLaunchArguments": {
      toReplace,
      classPaths,
    },
    necessaries,
    finalizedPatch,
    javaBinary,
  });

  return {
    "program"  : launcherJar,
    "java"     : javaBinary,
    "arguments": launchArguments,
  };
}
