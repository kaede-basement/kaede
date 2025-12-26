import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { downloadWithProgress } from "@/lib/launcher/scopes/download-with-progress.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getLogging({
  baseDirectory,
  logging,
  statuses,
}: {
  "baseDirectory": string;
  "logging"      : SpecificPatchMetaType["logging"];
  "statuses"     : LauncherStatusesType;
}): Promise<string | false> {
  if (
    logging === undefined ||
    logging?.type === undefined ||
    logging?.file === undefined ||
    logging?.argument === undefined
  ) {
    statuses.add(LaunchStatus.Errors.LoggingMissingMeta);

    return false;
  }

  // Already contains an extension (.xml)
  const name: string | undefined = logging.file?.id;
  const url: string | undefined = logging?.file?.url;

  if (!name || !url) {
    statuses.add(LaunchStatus.Errors.LoggingMissingMeta);

    return false;
  }

  const logConfigDirectory = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Assets.Path,
    "log_configs",
  );
  const filePath = General.cachedJoin(
    logConfigDirectory,
    name,
  );

  statuses.add(LaunchStatus.Logging.CheckingIfPresent);

  const [
    directoryExists,
    fileExists,
  ]: [
    boolean,
    boolean,
  ] = await Promise.all([
    exists(logConfigDirectory),
    exists(filePath),
  ]);

  if (!directoryExists) {
    await mkdir(logConfigDirectory);
  }

  if (!fileExists) {
    statuses.add(LaunchStatus.Logging.DownloadingConfig);
    await downloadWithProgress({
      "statusScope": LaunchStatus.Logging.DownloadingConfig,
      url,
      filePath,
      statuses,
    });
  }

  statuses.add(LaunchStatus.Logging.Done);

  return filePath;
}
