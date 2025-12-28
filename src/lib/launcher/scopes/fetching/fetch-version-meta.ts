import { fetch } from "@tauri-apps/plugin-http";

import { APIEndpoints, LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function fetchVersionMeta({
  version,
}: {
  "version": SpecificPatchMetaType["version"];
}): Promise<object | LaunchStatusType> {
  const url: string =
    APIEndpoints.Meta.Base +
    APIEndpoints.Meta.Paths.Minecraft.Base +
    version +
    ".json";

  let response: Response;
  let data: unknown;

  try {
    log.debug(`Fetching the version meta from '${url}'`);

    response = await fetch(url);
  } catch (error: unknown) {
    log.error(`Could not fetch '${url}':`, Errors.prettify(error));

    return LaunchStatus.Errors.MetaVersionFetchFailed;
  }

  if (response.status === 404) {
    return LaunchStatus.Errors.VersionNotFoundInMeta;
  }

  try {
    data = await response.json();
  } catch (error: unknown) {
    log.error(`Could not parse the data from '${url}':`, Errors.prettify(error));

    return LaunchStatus.Errors.MetaVersionParseFailed;
  }

  // Full validation will be provided later in the code
  if (typeof data !== "object" || data === null) {
    log.error(
      `Failed to shallowly validate the parsed data from '${url}'. Contents:`,
      "\n" + JSON.stringify(data, null, 2),
    );

    return LaunchStatus.Errors.MetaVersionShallowValidationFailed;
  }

  return data;
}
