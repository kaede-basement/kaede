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

import { fetch } from "@tauri-apps/plugin-http";

import { LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  LaunchKeyType,
  LaunchStatusType,
} from "@/types/launcher/launch/launch-status.type.ts";

export async function fetchMetadata({
  url,
  label,
  scope,
}: {
  "url"  : string;
  "label": string;
  "scope": LaunchKeyType;
}): Promise<object | LaunchStatusType> {
  let response: Response;
  let data: unknown;

  try {
    log.debug(`Fetching the ${label} from '${url}'`);

    response = await fetch(url);
  } catch (error: unknown) {
    log.error(`Could not fetch '${url}':`, Errors.prettify(error));

    return LaunchStatus[scope].MetadataFetchFailed;
  }

  try {
    data = await response.json();
  } catch (error: unknown) {
    log.error(`Could not parse the data from '${url}':`, Errors.prettify(error));

    return LaunchStatus[scope].MetadataParseFailed;
  }

  // Full validation will be provided later in the code
  if (typeof data !== "object" || data === null) {
    log.error(
      `Failed to shallowly validate the parsed data from '${url}'. Contents:`,
      "\n" + JSON.stringify(data, null, 2),
    );

    return LaunchStatus[scope].MetadataShallowValidationFailed;
  }

  return data;
}
