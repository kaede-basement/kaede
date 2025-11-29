import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";

export async function getVersionMetadata({
  changeStatus,
  url,
}: {
  "changeStatus": (newStatus: LaunchStatusType) => void;
  "url"         : string;
}): object {}