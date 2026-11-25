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

import { resolvePatch } from "@/lib/launcher/scopes/patches/resolve-patch.ts";
import type { PatchDependencyType } from "@/types/launcher/meta/patch-index.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function resolveSubPatches({
  necessaries,
  patchMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "patchMeta"  : SpecificPatchMetaType;
}): Promise<Array<SpecificPatchMetaType>> {
  const patches = new Map<string, SpecificPatchMetaType>([[patchMeta.uid, patchMeta]]);
  const dependents = (new Map<string, number>);

  for (const patch of patches.values()) {
    const missing: Array<PatchDependencyType> = [];

    for (const required of patch.requires ?? []) {
      if (!dependents.has(required.uid) && !patches.has(required.uid)) {
        missing.push(required);
      }
      dependents.set(required.uid, (dependents.get(required.uid) ?? 0) + 1);
    }

    const resolved = await Promise.all(missing.map(async metadata => {
      const result = await resolvePatch({ necessaries, metadata, patchMeta });

      if (!result) {
        throw new Error(`Failed to resolve required patch ${metadata.uid}`);
      }

      return result;
    }));

    for (const [index, result] of resolved.entries()) {
      patches.set(missing[index].uid, result);
    }
  }

  // Finalization applies the result in reverse, so every dependent must precede its dependencies.
  const ordered = dependents.has(patchMeta.uid) ? [] : [patchMeta];

  for (const patch of ordered) {
    for (const { uid, equals } of patch.requires ?? []) {
      const dependency = patches.get(uid)!;
      const version = necessaries.user.versions?.[uid] ?? equals;

      if (version !== undefined && version !== dependency.version) {
        throw new Error(`Conflicting required version of ${uid}: ${version}`);
      }

      const remaining = dependents.get(uid)! - 1;

      dependents.set(uid, remaining);
      if (remaining === 0) {
        ordered.push(dependency);
      }
    }
  }

  if (ordered.length !== patches.size) {
    throw new Error("Cycle in required Minecraft patches");
  }

  return ordered;
}
