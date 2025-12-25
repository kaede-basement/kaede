import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { downloadWithProgress } from "@/lib/launcher/scopes/download-with-progress.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export async function getLogging({
  baseDirectory,
  logging,
  statuses,
}: {
  "baseDirectory": string;
  "logging"      : MetaMinecraftVersionType["logging"];
  "statuses"     : LauncherStatusesType;
}): Promise<string> {
  // Already contains an extension (.xml)
  const name = logging.file.id;
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
    const url: string = logging.file.url;

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
