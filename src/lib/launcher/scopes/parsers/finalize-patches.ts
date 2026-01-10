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

import { parseLibraries } from "@/lib/launcher/scopes/parsers/parse-libraries.ts";
import { parseLogging } from "@/lib/launcher/scopes/parsers/parse-logging.ts";
import { parseMainJar } from "@/lib/launcher/scopes/parsers/parse-main-jar.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchLibraryType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

function addArtifactsToMap(
  necessaries: PreLaunchInformationType,
  libraries: Array<SpecificPatchLibraryType> | undefined,
  map: Map<string, MappedArtifactType>,
  isMaven: boolean,
): void {
  if (!libraries) {
    return;
  }

  const artifacts = parseLibraries({
    necessaries,
    libraries,
    isMaven,
  });

  for (const artifact of artifacts) {
    const id = artifact.id;

    map.set(id, artifact);
  }
}

export function finalizePatches({
  patches,
  necessaries,
}: {
  "patches"    : Array<SpecificPatchMetaType>;
  "necessaries": PreLaunchInformationType;
}): FinalizedPatchType {
  // The last ones are the main patches; thus, they should overwrite what was previously written
  const reversed: Array<SpecificPatchMetaType> = patches.reverse();
  // Patches might have overlapping artifacts with different versions
  const uniqueArtifacts = new Map<string, MappedArtifactType>;
  const built: FinalizedPatchType = {
    "+traits"  : [],
    "+tweakers": [],
    "artifacts": [],

    /*
     * Ancient versions do not have the 'mainClass' field,
     * so use their class as a default value
     */
    "mainClass"         : "net.minecraft.client.Minecraft",
    "minecraftArguments": "",
    "assetIndex"        : undefined,
    "type"              : undefined,
    "client"            : false,
    "logging"           : false,
  };

  for (const patch of reversed) {
    if (patch?.["+traits"]) {
      built["+traits"].push(...patch["+traits"]);
    }

    if (patch?.["+tweakers"]) {
      built["+tweakers"].push(...patch["+tweakers"]);
    }

    addArtifactsToMap(necessaries, patch.mavenFiles, uniqueArtifacts, true);
    addArtifactsToMap(necessaries, patch.libraries, uniqueArtifacts, false);

    if (patch.mainClass) {
      built.mainClass = patch.mainClass;
    }

    if (patch.minecraftArguments) {
      built.minecraftArguments = patch.minecraftArguments;
    }

    if (patch.assetIndex) {
      built.assetIndex = patch.assetIndex;
    }

    if (patch.type) {
      built.type = patch.type;
    }

    const currentLogging = parseLogging({
      "logging": patch?.logging,
      necessaries,
    });
    const currentClient = parseMainJar({
      "client": patch?.mainJar,
      necessaries,
    });

    // Overwrite the 'logging' field only if the parsed data is defined
    if (currentLogging) {
      built.logging = currentLogging;
    }

    // Overwrite the 'client' field only if the parsed data is defined
    if (currentClient) {
      built.client = currentClient;
    }
  }

  built.artifacts = [...uniqueArtifacts.values()];

  return built;
}
