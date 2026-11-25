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

import { APIEndpoints, LaunchStatus } from "@/constants/launcher.ts";
import { safeComponent, validDigest } from "@/lib/cache/storage.ts";
import type { PatchDependencyType } from "@/types/launcher/meta/patch-index.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

import { readLaunchMetadata } from "../fetching/fetch-metadata.ts";

type Version = { "version": string; "sha256"?: string };
type Request = { "necessaries": PreLaunchInformationType; "metadata": PatchDependencyType };

function validIndex(value: unknown): value is { "versions": [Version] } {
  if (!value || typeof value !== "object" || !("versions" in value)
    || !Array.isArray(value.versions)) return false;
  const first = value.versions[0];

  return typeof first?.version === "string" && safeComponent(first.version)
    && validDigest({ "kind": "sha256", "sum": first.sha256 });
}

export async function resolveVersionDocument({ necessaries, metadata }: Request):
Promise<Version | false> {
  if (!safeComponent(metadata.uid)) {
    necessaries.statuses.current = LaunchStatus.PatchIndex.FailedToValidate;

    return false;
  }
  const version = necessaries.user.versions?.[metadata.uid] ?? metadata.equals ?? metadata.suggests;

  if (version !== undefined) return { version };
  const index = await readLaunchMetadata("PatchIndex", necessaries, {
    "relativePath": metadata.uid + ".json",
    "url"         : APIEndpoints.Meta.Base + metadata.uid,
    "validate"    : validIndex,
  });

  return "data" in index && index.data.versions[0];
}

export async function resolvePatchVersion(request: Request): Promise<string | false> {
  const resolved = await resolveVersionDocument(request);

  return resolved && resolved.version;
}
