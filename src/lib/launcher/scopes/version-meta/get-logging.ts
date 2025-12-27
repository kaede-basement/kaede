import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { downloadWithProgress } from "@/lib/launcher/scopes/download-with-progress.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function getLogging({
  necessaries,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<boolean> {
  const beforeHooksResult: "continue" | boolean | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftLoggingGet",
      "toPass": { necessaries, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses } = necessaries;
  const logging: SpecificPatchMetaType["logging"] = versionMeta?.logging;

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

  const filePath = General.cachedJoin(
    directories.logging,
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
    exists(directories.logging),
    exists(filePath),
  ]);

  if (!directoryExists) {
    await mkdir(directories.logging);
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

  const afterHooksResult: "continue" | boolean | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftLoggingGet",
      "toPass": { necessaries, versionMeta },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  statuses.add(LaunchStatus.Logging.Done);

  return true;
}
