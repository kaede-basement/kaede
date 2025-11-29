import { fetch } from "@tauri-apps/plugin-http";

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
  const response = await fetch(url);
  const data = await response.json();

  return {
    "updateCache": true,
    "metadata"   : data,
  };
}