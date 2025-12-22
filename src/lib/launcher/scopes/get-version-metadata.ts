import { fetch } from "@tauri-apps/plugin-http";

import { LaunchStatus } from "@/constants/launcher.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { VersionMetadataType } from "@/types/launcher/version-metadata.type.ts";

export async function getVersionMetadata({
  currentStatuses,
  url,
}: {
  "currentStatuses": LauncherStatusesType;
  "url"            : string;
}): Promise<{
  "updateCache": boolean;
  "metadata"   : VersionMetadataType;
}> {
  currentStatuses.value.add(LaunchStatus.VersionMetadata.FetchingResponse);
  const response = await fetch(url);

  currentStatuses.value.add(LaunchStatus.VersionMetadata.ReadingResponse);
  const data = await response.json();

  currentStatuses.value.add(LaunchStatus.VersionMetadata.Validating);

  return {
    "updateCache": true,
    "metadata"   : data,
  };
}