import { fetch } from "@tauri-apps/plugin-http";

import { LaunchStatus } from "@/constants/launcher.ts";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";
import type { VersionMetadataType } from "@/types/launcher/version-metadata.type.ts";

export async function getVersionMetadata({
  changeStatus,
  url,
}: {
  "changeStatus": (newStatus: LaunchStatusType) => void;
  "url"         : string;
}): Promise<{
  "updateCache": boolean;
  "metadata"   : VersionMetadataType;
}> {
  changeStatus(LaunchStatus.VersionMetadata.FetchingResponse);
  const response = await fetch(url);

  changeStatus(LaunchStatus.VersionMetadata.ReadingResponse);
  const data = await response.json();

  changeStatus(LaunchStatus.VersionMetadata.Validating);

  return {
    "updateCache": true,
    "metadata"   : data,
  };
}