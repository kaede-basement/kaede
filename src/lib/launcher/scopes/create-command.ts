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
  "arguments": string;
}> {
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
    getJavaBinary({ necessaries, finalizedPatch }),
    getJvmArguments({ necessaries, finalizedPatch }),
    getClassPaths({ necessaries, finalizedPatch }),
    getGameArguments({ necessaries, finalizedPatch }),
  ]);

  const additionalArguments: string = await getAdditionalStartArguments({
    javaBinary,
    necessaries,
    finalizedPatch,
  });

  const toReplace: Array<string> = [
    jvmArguments,
    classPathsArgument,
    finalizedPatch.mainClass,
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
    necessaries,
    finalizedPatch,
    javaBinary,
  });

  return {
    "program"  : javaBinary,
    "arguments": launchArguments,
  };
}
