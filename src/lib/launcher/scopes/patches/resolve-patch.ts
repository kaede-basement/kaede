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
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { fetchMetadata } from "@/lib/launcher/scopes/fetching/fetch-metadata.ts";
import { resolvePatchVersion } from "@/lib/launcher/scopes/patches/resolve-patch-version.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { LaunchStatusType } from "@/types/launcher/launch/launch-status.type.ts";
import type { PatchRequiresType } from "@/types/launcher/meta/patch-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function resolvePatch({
  necessaries,
  versionMeta,
  metadata,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "metadata"   : PatchRequiresType;
}): Promise<SpecificPatchMetaType | false> {
  const beforeHooksResult: "continue" | SpecificPatchMetaType | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<SpecificPatchMetaType | false>({
      "scope" : "onMinecraftPatchResolve",
      "toPass": { necessaries, versionMeta, metadata },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses } = necessaries;
  const version: string | false = await resolvePatchVersion({ necessaries, metadata });
  const fileName: string = version + ".json";
  const logPrefix: string = metadata.uid + fileName;
  let parsedPatch: unknown;

  log.debug(__PRE_BUNDLED_FILENAME__, `${logPrefix} | Reading the cached patch metadata`);
  statuses.current = LaunchStatus.PatchMetadata.Reading;
  try {
    parsedPatch = await General.handleJsonFile({
      "baseDirectory"  : directories.base,
      "path"           : [FileStructure.Folders.Cache.Path, metadata.uid, fileName],
      "label"          : `/cache/${metadata.uid}/${fileName}`,
      "getDefaultValue": async () => {
        log.warn(
          __PRE_BUNDLED_FILENAME__,
          `${logPrefix} | No cache; fetching the patch metadata`,
        );
        statuses.current = LaunchStatus.PatchMetadata.Fetching;
        const fetched: { "data": unknown } | LaunchStatusType = await fetchMetadata({
          "url"   : APIEndpoints.Meta.Base + metadata.uid + "/" + fileName,
          "label" : "patch metadata",
          "scope" : "PatchMetadata",
          "prefix": logPrefix,
        });

        // Just return the patch metadata
        if (typeof fetched === "object") {
          return fetched.data;
        }

        log.error(
          __PRE_BUNDLED_FILENAME__,
          `${logPrefix} | Could not fetch the patch metadata. Status: ${fetched}`,
        );
        statuses.current = fetched;

        /*
         * The 'General#handleJsonFile' function writes the returned value
         * into the file specified earlier, but in case of an error we do not
         * want to write anything. Moreover, we want to stop the launch process execution
         * since we cannot handle a MultiMC patch without its metadata
         */
        throw new Error(`An error occurred while fetching the patch metadata (${metadata.uid})`);
      },
    });
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `${logPrefix} | Caught an error while getting the patch metadata:`,
      Errors.prettify(error),
    );

    return false;
  }

  log.debug(__PRE_BUNDLED_FILENAME__`, ${logPrefix} | Validating the patch metadata`);
  const validPatch: SpecificPatchMetaType | false = Schemas.validate.patchMeta({
    "value": parsedPatch,
    "label": "patch metadata",
    "info" : {
      "id": metadata.uid,
    },
  });

  if (validPatch === false) {
    log.error(__PRE_BUNDLED_FILENAME__, `${logPrefix} | Invalid metadata`);

    return false;
  }

  const afterHooksResult: "continue" | SpecificPatchMetaType | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<SpecificPatchMetaType | false>({
      "scope" : "onMinecraftPatchResolve",
      "toPass": { necessaries, versionMeta, metadata },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  log.info(__PRE_BUNDLED_FILENAME__, `${logPrefix} | Successful validation`);

  return validPatch;
}
