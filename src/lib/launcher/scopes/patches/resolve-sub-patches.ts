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

import { resolveDependency } from "@/lib/launcher/scopes/patches/resolve-patch.ts";
import type { PatchDependencyType } from "@/types/launcher/meta/patch-index.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function resolveSubPatches({
  necessaries,
  patchMeta,
  signal,
}: {
  "signal"?    : AbortSignal;
  "necessaries": PreLaunchInformationType;
  "patchMeta"  : SpecificPatchMetaType;
}): Promise<Array<SpecificPatchMetaType>> {
  type UID = PatchDependencyType["uid"];
  type Resolution = Awaited<ReturnType<typeof resolveDependency>>;

  const selected = new Map<UID, Resolution>([[patchMeta.uid, patchMeta]]);
  const cache = new Map<string, Resolution>;
  const previousSelections = new Set<string>;

  // A newly discovered exact requirement can replace a suggested version and its entire subtree.
  for (;;) {
    const reachable = new Set<UID>([patchMeta.uid]);
    const requirements = new Map<UID, PatchDependencyType>;
    const dependents = new Map<UID, number>;
    let conflict: UID | undefined;

    for (const uid of reachable) {
      const patch = selected.get(uid);

      if (!patch) {
        continue;
      }

      for (const dependency of patch.requires ?? []) {
        reachable.add(dependency.uid);
        dependents.set(dependency.uid, (dependents.get(dependency.uid) ?? 0) + 1);
        const previous = requirements.get(dependency.uid);

        const upgrade = previous?.equals === undefined && (
          dependency.equals !== undefined ||
          (previous?.suggests === undefined && dependency.suggests !== undefined)
        );

        if (!previous || upgrade) {
          requirements.set(dependency.uid, dependency);
        } else if (dependency.equals !== undefined && previous.equals !== dependency.equals) {
          conflict = dependency.uid;
        }
      }
    }

    const choices = [...requirements.values()].filter(({ uid }) => uid !== patchMeta.uid);
    const keys = choices.map(({ uid, equals, suggests }) => {
      return JSON.stringify([uid, equals, suggests]);
    });
    const results = await Promise.all(choices.map(async (metadata, index) => {
      const key = keys[index];

      if (!cache.has(key)) {
        cache.set(key, await resolveDependency({ necessaries, metadata, patchMeta, signal }));
      }

      return cache.get(key);
    }));

    const changed = choices.some(({ uid }, index) => {
      return !selected.has(uid) || selected.get(uid) !== results[index];
    });

    if (changed) {
      const signature = JSON.stringify([...keys].sort());

      if (previousSelections.has(signature)) {
        throw new Error("Conflicting Minecraft patch dependency selections");
      }
      previousSelections.add(signature);
      for (const [index, { uid }] of choices.entries()) {
        selected.set(uid, results[index]);
      }
      continue;
    }

    if (conflict) {
      throw new Error(`Conflicting exact requirements for ${conflict}`);
    }

    for (const uid of reachable) {
      if (selected.get(uid) === false) {
        throw new Error(`Failed to resolve required patch ${uid}`);
      }
    }

    // Finalization walks this order backwards. A dependency follows all its dependents.
    const ordered = dependents.has(patchMeta.uid) ? [] : [patchMeta];

    for (const patch of ordered) {
      for (const { uid } of patch.requires ?? []) {
        const remaining = dependents.get(uid)! - 1;

        dependents.set(uid, remaining);
        const dependency = selected.get(uid);

        if (remaining === 0 && dependency) {
          ordered.push(dependency);
        }
      }
    }

    if (ordered.length !== [...reachable].filter(uid => selected.get(uid)).length) {
      throw new Error("Cycle in required Minecraft patches");
    }

    return ordered;
  }
}
