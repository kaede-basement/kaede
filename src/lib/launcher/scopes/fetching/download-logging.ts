import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { downloadWithProgress } from "@/lib/launcher/scopes/fetching/download-with-progress.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ParsedMetaType } from "@/types/launcher/meta/parsed-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function downloadLogging({
  necessaries,
  logging,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "logging"    : ParsedMetaType["logging"];
  "versionMeta": SpecificPatchMetaType;
}): Promise<void> {
  if (!logging) {
    log.warn(
      __PRE_BUNDLED_FILENAME__,
      "No logging field found. Perhaps, the instance version is pre-1.7?",
    );
    necessaries.statuses.current = LaunchStatus.Logging.Done;

    return;
  }

  const beforeHooksResult: "continue" | void | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<void>({
      "scope" : "onMinecraftLoggingGet",
      "toPass": { necessaries, logging, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue") {
    return;
  }

  const { directories, statuses } = necessaries;
  const { url, path } = logging;

  log.debug(__PRE_BUNDLED_FILENAME__, "Checking if the logging config exists");
  statuses.current = LaunchStatus.Logging.CheckingIfPresent;

  const [
    directoryExists,
    fileExists,
  ]: [
    boolean,
    boolean,
  ] = await Promise.all([
    exists(directories.logging),
    exists(path),
  ]);

  if (!directoryExists) {
    log.warn(__PRE_BUNDLED_FILENAME__, "The logging config directory does not exist");
    await mkdir(directories.logging);
  }

  if (!fileExists) {
    log.warn(__PRE_BUNDLED_FILENAME__, "The logging config file does not exist");
    log.debug(__PRE_BUNDLED_FILENAME__, "Downloading the logging config file");
    statuses.current = LaunchStatus.Logging.DownloadingConfig;
    await downloadWithProgress({
      "statusScope": LaunchStatus.Logging.DownloadingConfig,
      path,
      url,
      statuses,
    });
  }

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftLoggingGet",
    "toPass": { necessaries, logging, versionMeta },
    "timing": "after",
  });

  log.info(__PRE_BUNDLED_FILENAME__, "Successfully handled the logging config");
  statuses.current = LaunchStatus.Logging.Done;
}
