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

import { FileStructure } from "@/constants/file-structure.ts";
import { APIEndpoints, LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import { fetchMetadata } from "@/lib/launcher/scopes/fetching/fetch-metadata.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LaunchStatusType } from "@/types/launcher/launch/launch-status.type.ts";
import type { PatchRequiresType } from "@/types/launcher/meta/patch-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function resolvePatchVersion({
  necessaries,
  metadata,
}: {
  "necessaries": PreLaunchInformationType;
  "metadata"   : PatchRequiresType;
}): Promise<string | false> {
  const { "user": { versions } } = necessaries;
  const selected: string | undefined = versions?.[metadata.uid];

  // Return the user selected version
  if (selected !== undefined) {
    return selected;
  }

  // 'requires' entry usually has a specified version
  const specified: string | undefined = metadata.equals ?? metadata.suggests;

  // Return the version suggested by metadata
  if (specified !== undefined) {
    return specified;
  }

  const { directories, statuses } = necessaries;
  const fileName: string = metadata.uid + ".json";
  let parsedPatchIndex: unknown;

  log.debug(`${metadata.uid} | Reading the cached index manifest`);
  statuses.current = LaunchStatus.PatchIndex.Reading;
  try {
    parsedPatchIndex = await General.handleJsonFile({
      "baseDirectory"  : directories.base,
      "path"           : [FileStructure.Folders.Cache.Path, fileName],
      "label"          : `/cache/${fileName}`,
      "getDefaultValue": async () => {
        log.debug(`${metadata.uid} | No cache; fetching the index manifest`);
        statuses.current = LaunchStatus.PatchIndex.Fetching;
        const fetched: { "data": unknown } | LaunchStatusType = await fetchMetadata({
          "url"   : APIEndpoints.Meta.Base + metadata.uid,
          "label" : "index manifest",
          "scope" : "PatchIndex",
          "prefix": metadata.uid,
        });

        // Just return the patch index manifest
        if (typeof fetched === "object") {
          return fetched.data;
        }

        log.error(`${metadata.uid} | Could not fetch the index manifest. Status: ${fetched}`);
        statuses.current = fetched;

        /*
         * The 'General#handleJsonFile' function writes the returned value
         * into the file specified earlier, but in case of an error we do not
         * want to write anything. Moreover, we want to stop the launch process execution
         * since we cannot handle a MultiMC patch without the version
         */
        throw new Error(`An error occurred while fetching the index manifest (${metadata.uid})`);
      },
    });
  } catch (error: unknown) {
    log.error(
      `${metadata.uid} | Caught an error while getting the index manifest:`,
      Errors.prettify(error),
    );

    return false;
  }

  log.debug(`${metadata.uid} | Validating the index manifest`);

  if (
    // Ensure the index manifest is an object
    typeof parsedPatchIndex !== "object" ||
    parsedPatchIndex === null ||
    // Ensure the 'versions' field is a non-empty array
    !("versions" in parsedPatchIndex) ||
    !Array.isArray(parsedPatchIndex.versions) ||
    parsedPatchIndex.versions.length <= 0 ||
    // Ensure the provided 'versions' entry has a string typed 'version' field
    typeof parsedPatchIndex.versions[0] !== "object" ||
    parsedPatchIndex.versions[0] === null ||
    !("version" in parsedPatchIndex.versions[0]) ||
    typeof parsedPatchIndex.versions[0].version !== "string"
  ) {
    log.error(
      `${metadata.uid} | Failed to shallowly validate the index manifest. Contents:`,
      "\n" + JSON.stringify(parsedPatchIndex, null, 2),
    );
    statuses.current = LaunchStatus.PatchIndex.FailedToValidate;

    return false;
  }

  return parsedPatchIndex.versions[0].version;
}
