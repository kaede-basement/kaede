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

import Arguments from "@/lib/launcher/scopes/arguments";
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
  "java"     : string;
  "arguments": Array<string>;
}> {
  const [
    // Java applet, unused: launcherJar,
    javaBinary,
    jvmArguments,
    { "argument": classPathsArgument, classPaths },
    gameArguments,
    additionalArguments,
  ]: [
    string,
    Array<string>,
    { "argument": [string, string]; "classPaths": string },
    Array<string>,
    Array<string>,
  ] = await Promise.all([
    // Java applet, unused: resolveResource(ResourceLauncher),
    Arguments.getJavaBinary({ necessaries, finalizedPatch }),
    Arguments.getJvmArguments({ necessaries, finalizedPatch }),
    Arguments.getClassPaths({ necessaries, finalizedPatch }),
    Arguments.getGameArguments({ necessaries, finalizedPatch }),
    Arguments.getAdditionalStartArguments({ necessaries, finalizedPatch }),
  ]);

  const toReplace: Array<string> = [
    ...additionalArguments,
    ...jvmArguments,
    ...classPathsArgument,
    finalizedPatch.mainClass,
    ...gameArguments,
  ];

  const launchArguments: Array<string> = Arguments.replaceLaunchArguments({
    "auth": {
      "uuid"    : "0204254bf42f3ceeb58de7d6f7890452",
      "token"   : "none",
      "username": "windstone_",
      "type"    : "mojang",
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
    // Unused: "program": launcherJar
    "java"     : javaBinary,
    "arguments": launchArguments,
  };
}
