import { download } from "@tauri-apps/plugin-upload";

import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

export function downloadWithProgress({
  url,
  path,
  statusScope,
  statuses,
}: {
  "url"        : string;
  "path"       : string;
  "statusScope": string;
  "statuses"   : LauncherStatusesType;
}): Promise<void> {
  const status: string = statusScope + "-" + url;
  let previousStatus: string = status;

  return download(
    url,
    path,
    ({ progressTotal, total }) => {
      const percents: number = Math.floor(progressTotal / total * 100);
      const progressStatus: string = status + "-" + percents + "%";

      statuses.downloads.delete(previousStatus);
      statuses.downloads.add(progressStatus);

      previousStatus = progressStatus;
    },
  );
}
