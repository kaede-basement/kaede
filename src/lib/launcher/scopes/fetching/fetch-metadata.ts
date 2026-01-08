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
