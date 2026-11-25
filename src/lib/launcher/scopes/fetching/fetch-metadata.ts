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

import { fetch } from "@tauri-apps/plugin-http";

import { LaunchStatus } from "@/constants/launcher.ts";
import { cachedMetadata } from "@/lib/cache";
import { SchemaError, ValidationError } from "@/lib/cache/storage.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import type {
  LaunchKeyType,
  LaunchStatusType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function fetchMetadata({
  url,
  label,
  scope,
  prefix,
}: {
  "url"   : string;
  "label" : string;
  "scope" : Extract<LaunchKeyType, "PatchIndex" | "PatchMetadata" | "AssetIndex">;
  "prefix": string;
}): Promise<{ "data": unknown } | LaunchStatusType> {
  let response: Response;
  let data: unknown;

  try {
    log.debug(`${prefix}:${__PRE_BUNDLED_FILENAME__}`, `Fetching the ${label} from '${url}'`);

    response = await fetch(url);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error: unknown) {
    log.error(
      `${prefix}:${__PRE_BUNDLED_FILENAME__}`,
      `Could not fetch '${url}':`,
      Errors.prettify(error),
    );

    return LaunchStatus[scope].FailedToFetch;
  }

  try {
    data = await response.json();
  } catch (error: unknown) {
    log.error(
      `${prefix}:${__PRE_BUNDLED_FILENAME__}`,
      `Could not parse the ${label} from '${url}':`,
      Errors.prettify(error),
    );

    return LaunchStatus[scope].FailedToParse;
  }

  return { data };
}

export async function readLaunchMetadata<T>(
  scope: "PatchMetadata" | "PatchIndex" | "AssetIndex",
  necessaries: Pick<PreLaunchInformationType, "statuses" | "directories" | "logPrefix">,
  options: Omit<Parameters<typeof cachedMetadata>[0], "validate" | "baseDirectory"> & {
    "validate": (value: unknown) => value is T;
  },
): Promise<{ "data": T; "bytes": Uint8Array<ArrayBuffer> } | { "schemaFailure": boolean }> {
  const { statuses, directories, logPrefix } = necessaries;

  statuses.current = LaunchStatus[scope].Reading;
  try {
    const result = await cachedMetadata({
      ...options, "baseDirectory": directories.base,
      "onFetch"      : () => {
        statuses.current = LaunchStatus[scope].Fetching;
      },
    });

    return { "data": result.data as T, "bytes": result.bytes };
  } catch (error) {
    const failure = error instanceof SyntaxError ? "FailedToParse"
      : (error instanceof ValidationError ? "FailedToValidate" : "FailedToFetch");

    statuses.current = LaunchStatus[scope][failure];
    log.error(logPrefix, options.url, Errors.prettify(error));

    return { "schemaFailure": error instanceof SchemaError };
  }
}
