import { download } from "@tauri-apps/plugin-upload";

import { LaunchStatus } from "@/constants/launcher.ts";
import type {
  LauncherStatusesType,
  LaunchStatusType,
} from "@/types/launcher/launch-status.type.ts";

export function downloadAssetObject({
  url,
  filePath,
  currentStatuses,
}: {
  "url"            : string;
  "filePath"       : string;
  "currentStatuses": LauncherStatusesType;
}): Promise<void> {
  const status: string = LaunchStatus.Assets.DownloadingAsset + "-" + url;
  let previousStatus: string = status;

  return download(
    url,
    filePath,
    ({ progressTotal, total }) => {
      const percents: number = Math.floor(progressTotal / total * 100);
      const progressStatus: string = status + "-" + percents + "%";

      currentStatuses.value.delete(previousStatus as LaunchStatusType);
      currentStatuses.value.add(progressStatus as LaunchStatusType);
      previousStatus = progressStatus;
    },
  );
}
