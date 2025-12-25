import { download } from "@tauri-apps/plugin-upload";

import type {
  LauncherStatusesType,
  LaunchStatusType,
} from "@/types/launcher/launch-status.type.ts";

export function downloadWithProgress({
  url,
  filePath,
  statusScope,
  statuses,
}: {
  "url"        : string;
  "filePath"   : string;
  "statusScope": string;
  "statuses"   : LauncherStatusesType;
}): Promise<void> {
  const status: string = statusScope + "-" + url;
  let previousStatus: string = status;

  return download(
    url,
    filePath,
    ({ progressTotal, total }) => {
      const percents: number = Math.floor(progressTotal / total * 100);
      const progressStatus: string = status + "-" + percents + "%";

      statuses.delete(previousStatus as LaunchStatusType);
      statuses.add(progressStatus as LaunchStatusType);

      previousStatus = progressStatus;
    },
  );
}
