import { download } from "@tauri-apps/plugin-upload";

import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

export function downloadWithProgress({
  url,
  path,
  statuses,
}: {
  "url"     : string;
  "path"    : string;
  "statuses": LauncherStatusesType;
}): Promise<void> {
  return download(
    url,
    path,
    ({ progressTotal, total, transferSpeed }) => {
      const percents: number = Math.floor(progressTotal / total * 100);

      if (percents === 100) {
        return statuses.downloads.current.delete(url);
      }

      statuses.downloads.current.set(url, [percents, transferSpeed]);
    },
  );
}
