import type { DownloadReportType } from "@/types/launcher/artifacts/download.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

export const launchAttempts = new WeakMap<LauncherStatusesType, { "stop"?: Promise<boolean> }>;
export class ArtifactDownloadFailure extends Error {}
export class CancelledDownload extends Error {}

export function interruptedDownload(statuses: LauncherStatusesType): false {
  if (launchAttempts.has(statuses)) {
    throw (new CancelledDownload);
  }

  return false;
}

export function downloadSucceeded(
  report: DownloadReportType, statuses: LauncherStatusesType,
): boolean {
  if (report.failed > 0) {
    if (launchAttempts.has(statuses)) {
      throw new ArtifactDownloadFailure(report.failures[0]?.error ?? "Artifact download failed");
    }

    return false;
  }

  return report.cancelled ? interruptedDownload(statuses) : true;
}
