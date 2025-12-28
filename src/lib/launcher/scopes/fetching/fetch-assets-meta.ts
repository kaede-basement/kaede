import { fetch } from "@tauri-apps/plugin-http";

import { LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";

export async function fetchAssetsMeta({
  url,
}: {
  "url": string;
}): Promise<object | LaunchStatusType> {
  let response: Response;
  let data: unknown;

  try {
    log.debug(`Fetching the assets meta from '${url}'`);

    response = await fetch(url);
  } catch (error: unknown) {
    log.error(`Could not fetch '${url}':`, Errors.prettify(error));

    return LaunchStatus.Errors.MetaAssetsFetchFailed;
  }

  try {
    data = await response.json();
  } catch (error: unknown) {
    log.error(`Could not parse the data from '${url}':`, Errors.prettify(error));

    return LaunchStatus.Errors.MetaAssetsParseFailed;
  }

  // Full validation will be provided later in the code
  if (typeof data !== "object" || data === null) {
    log.error(
      `Failed to shallowly validate the parsed data from '${url}'. Contents:`,
      "\n" + JSON.stringify(data, null, 2),
    );

    return LaunchStatus.Errors.MetaAssetsShallowValidationFailed;
  }

  return data;
}
