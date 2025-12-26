import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { downloadWithProgress } from "@/lib/launcher/scopes/download-with-progress.ts";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/normalize-artifact-path.ts";
import type {
  LauncherStatusesType,
} from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getClient({
  baseDirectory,
  mainJar,
  statuses,
}: {
  "baseDirectory": string;
  "mainJar"      : MetaMinecraftVersionType["mainJar"];
  "statuses"     : LauncherStatusesType;
}): Promise<string> {
  const name: string = mainJar.name;
  const normalizedPaths = normalizeArtifactPath(name);

  const directoryPath = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Libraries.Path,
    normalizedPaths.directory,
  );
  const filePath: string = General.cachedJoin(
    directoryPath,
    normalizedPaths.file + ".jar",
  );

  statuses.add(LaunchStatus.Client.CheckingIfPresent);
  const fileExists: boolean = await exists(filePath);

  if (fileExists) {
    statuses.add(LaunchStatus.Client.Done);

    return filePath;
  }

  const url: string = mainJar.downloads.artifact.url;

  await mkdir(directoryPath, { "recursive": true });
  await downloadWithProgress({
    "statusScope": LaunchStatus.Client.DownloadingJar,
    url,
    filePath,
    statuses,
  });

  statuses.add(LaunchStatus.Client.Done);

  return filePath;
}
