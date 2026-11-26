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

import FileStructure from "@/constants/file-structure.ts";
import { APIEndpoints, LaunchStatus } from "@/constants/launcher.ts";
import { CustomPatches } from "@/constants/meta.ts";
import { safeComponent } from "@/lib/cache/storage.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import Hooks from "@/lib/hooks";
import OptiFine from "@/lib/launcher/scopes/optifine";
import { log } from "@/lib/logging/log.ts";
import Schemas from "@/lib/schemas";
import type { PatchDependencyType } from "@/types/launcher/meta/patch-index.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

import { readLaunchMetadata } from "../fetching/fetch-metadata.ts";
import { resolveVersionDocument } from "./resolve-patch-version.ts";

function validPatchMetadata(value: unknown): value is SpecificPatchMetaType {
  return Schemas.PatchMetaValidator.Check(value);
}

export async function resolvePatch(request: {
  "necessaries": PreLaunchInformationType;
  "metadata"   : PatchDependencyType;
  "patchMeta" ?: SpecificPatchMetaType;
}): Promise<SpecificPatchMetaType | false> {
  return await resolveDependency(request) || false;
}

// Undefined denotes an explicit hook skip. False denotes a resolution failure.
export async function resolveDependency({
  necessaries,
  metadata,
  patchMeta,
}: Parameters<typeof resolvePatch>[0]): Promise<SpecificPatchMetaType | false | undefined> {
  const beforeHooksResult: "continue" | SpecificPatchMetaType | false | undefined =
    await Hooks.catchAsyncResponseHooks<SpecificPatchMetaType | false>({
      "scope" : "onMinecraftPatchResolve",
      "toPass": { necessaries, patchMeta, metadata },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult || undefined;
  }

  const { directories, statuses, logPrefix } = necessaries;
  const resolved = await resolveVersionDocument({ necessaries, metadata });

  if (!resolved) return false;
  const { version, sha256 } = resolved;

  if (!safeComponent(version)) {
    statuses.current = LaunchStatus.PatchMetadata.FailedToValidate;

    return false;
  }
  const fileName = version + ".json";
  const descriptiveLogPrefix = metadata.uid + ":" + fileName + ":" + logPrefix;
  let validPatch: SpecificPatchMetaType | false;

  if (metadata.uid === CustomPatches.OptiFine) {
    statuses.current = LaunchStatus.PatchMetadata.Reading;
    const generate = async (): Promise<unknown> => {
      statuses.current = LaunchStatus.PatchMetadata.Fetching;
      const patch = await OptiFine.resolveOptiFinePatch({ necessaries, version });

      if (!patch) throw new Error("Could not generate the OptiFine patch metadata");

      return patch;
    };

    try {
      const value = await FileManager.handleJsonFile({
        "baseDirectory"  : directories.base,
        "path"           : [FileStructure.Folders.Cache.Path, metadata.uid, fileName],
        "label"          : descriptiveLogPrefix,
        "getDefaultValue": generate,
        "invalidation"   : { "days": 7, "getNewValue": generate },
      });

      validPatch = Schemas.validate.patchMeta({ value, "label": "patch metadata",
        "info" : { "id": metadata.uid } });
    } catch (error) {
      statuses.current = LaunchStatus.PatchMetadata.FailedToFetch;
      log.error(descriptiveLogPrefix, Errors.prettify(error));

      return false;
    }
  } else {
    const url = APIEndpoints.Meta.Base + metadata.uid + "/" + encodeURIComponent(fileName);
    const result = await readLaunchMetadata("PatchMetadata", necessaries, {
      "relativePath": metadata.uid + "/" + fileName,
      url,
      "expectedHash": sha256 === undefined ? undefined : {
        "kind": "sha256", "sum": sha256.toLowerCase(),
      },
      "validate"           : validPatchMetadata,
      "allowUnindexedPatch": sha256 === undefined,
    });

    if ("schemaFailure" in result && !result.schemaFailure) return false;
    validPatch = "data" in result && result.data;
  }

  const afterHooksResult: "continue" | SpecificPatchMetaType | false | undefined =
    await Hooks.catchAsyncResponseHooks<SpecificPatchMetaType | false>({
      "scope" : "onMinecraftPatchResolve",
      "toPass": { necessaries, patchMeta, metadata, validPatch },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult || undefined;
  }

  if (validPatch === false) {
    statuses.current = LaunchStatus.PatchMetadata.FailedToValidate;
    log.error(descriptiveLogPrefix, "Invalid metadata");

    return false;
  }

  log.info(descriptiveLogPrefix, "Successful validation");

  return validPatch;
}
