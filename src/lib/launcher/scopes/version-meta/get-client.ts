import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { downloadWithProgress } from "@/lib/launcher/scopes/fetching/download-with-progress.ts";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/parsers/normalize-artifact-path.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function getClient({
  necessaries,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<string | false> {
  const beforeHooksResult: "continue" | string | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string | false>({
      "scope" : "onMinecraftClientGet",
      "toPass": { necessaries, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses } = necessaries;
  const mainJar: SpecificPatchMetaType["mainJar"] = versionMeta?.mainJar;

  if (
    mainJar === undefined ||
    mainJar?.name === undefined ||
    mainJar?.downloads === undefined
  ) {
    statuses.current = LaunchStatus.Errors.ClientMainJarMissingMeta;

    return false;
  }

  const name: string = mainJar.name;
  const normalizedPaths = normalizeArtifactPath(name);

  const directoryPath = General.cachedJoin(
    directories.libraries,
    normalizedPaths.directory,
  );
  const filePath: string = General.cachedJoin(
    directoryPath,
    normalizedPaths.file,
  );

  statuses.current = LaunchStatus.Client.CheckingIfPresent;
  const fileExists: boolean = await exists(filePath);

  if (fileExists) {
    const afterHooksResult: "continue" | string | false | undefined =
      await ExtensionsManager.catchAsyncResponseHooks<string | false>({
        "scope" : "onMinecraftClientGet",
        "toPass": { necessaries, versionMeta },
        "timing": "after",
      });

    if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
      return afterHooksResult;
    }

    statuses.current = LaunchStatus.Client.Done;

    return filePath;
  }

  const url: string | undefined = mainJar.downloads?.artifact?.url;

  if (!url) {
    statuses.current = LaunchStatus.Errors.ClientMainJarMissingMeta;

    return false;
  }

  await mkdir(directoryPath, { "recursive": true });
  await downloadWithProgress({
    "statusScope": LaunchStatus.Client.DownloadingJar,
    "path"       : filePath,
    url,
    statuses,
  });

  const afterHooksResult: "continue" | string | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string | false>({
      "scope" : "onMinecraftClientGet",
      "toPass": { necessaries, versionMeta },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  statuses.current = LaunchStatus.Client.Done;

  return filePath;
}
