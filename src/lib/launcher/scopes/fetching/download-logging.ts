import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { downloadWithProgress } from "@/lib/launcher/scopes/fetching/download-with-progress.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
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
  "logging"    : MappedArtifactType & {
    "argument": string;
  };
  "versionMeta": SpecificPatchMetaType;
}): Promise<void> {
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
    await mkdir(directories.logging);
  }

  if (!fileExists) {
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

  statuses.current = LaunchStatus.Logging.Done;
}
