import { mkdir } from "@tauri-apps/plugin-fs";

import { ConcurrentDownloads, LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { concurrentlyDownload } from "@/lib/general/scopes/concurrently-download.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function downloadLibraries({
  necessaries,
  libraries,
  natives,
}: {
  "necessaries": PreLaunchInformationType;
  "libraries"  : Array<MappedArtifactType>;
  "natives"    : Array<MappedArtifactType>;
}): Promise<void> {
  const { statuses } = necessaries;
  const merged: Array<MappedArtifactType> = [
    ...libraries,
    ...natives,
  ];
  const missing: Set<string> = new Set(
    await General.getMissingPaths({
      "paths": merged.map(({ path }) => path),
    }),
  );

  console.log("missing:", missing);

  const missingArtifacts: Array<MappedArtifactType> = merged
    .filter(({ path }) => {
      return missing.has(path);
    });

  log.debug("Initializing missing library and native directories");
  await Promise.all(
    missingArtifacts.map(({ directory }) => mkdir(
      directory,
      { "recursive": true },
    )),
  );

  await concurrentlyDownload({
    statuses,
    "concurrency": ConcurrentDownloads.Libraries,
    "entries"    : missingArtifacts,
    "statusScope": LaunchStatus.Libraries.DownloadingLibrary,
  });
}
