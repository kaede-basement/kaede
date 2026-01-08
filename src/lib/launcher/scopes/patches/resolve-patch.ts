/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026 windstone <notwindstone@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import ExtensionsManager from "@/lib/extensions-manager";
import { resolvePatchVersion } from "@/lib/launcher/scopes/patches/resolve-patch-version.ts";
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
}): Promise<Array<SpecificPatchMetaType>> {
  const beforeHooksResult: "continue" | Array<SpecificPatchMetaType> | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<SpecificPatchMetaType>>({
      "scope" : "onMinecraftPatchResolve",
      "toPass": { necessaries, versionMeta, metadata },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses } = necessaries;
  const version: string = await resolvePatchVersion({ necessaries, metadata });

  const afterHooksResult: "continue" | Array<SpecificPatchMetaType> | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<SpecificPatchMetaType>>({
      "scope" : "onMinecraftPatchResolve",
      "toPass": { necessaries, versionMeta, metadata },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }
}
