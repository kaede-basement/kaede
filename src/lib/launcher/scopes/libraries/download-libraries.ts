import { mkdir } from "@tauri-apps/plugin-fs";

import { ConcurrentDownloads, LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { downloadWithProgress } from "@/lib/launcher/scopes/download-with-progress.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/libraries/mapped-artifact.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

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

  const indexReference: { "value": number } = {
    "value": 0,
  };

  log.debug("Starting to download missing libraries and natives");
  await Promise.all(
    Array
      .from({ "length": ConcurrentDownloads.Libraries })
      .map(async (_, groupIndex: number): Promise<void> => {
        while (true) {
          if (indexReference.value >= missingArtifacts.length) {
            break;
          }

          const entryOutOfTotal = `${indexReference.value + 1}/${missingArtifacts.length}`;
          const index = indexReference.value++;
          const { url, "path": filePath } = missingArtifacts[index];

          log.debug(
            `Concurrency group ${groupIndex}: downloading (${entryOutOfTotal}) '${url}'`,
          );
          await downloadWithProgress({
            "statusScope": LaunchStatus.Libraries.DownloadingLibrary,
            url,
            filePath,
            statuses,
          });
        }
      }),
  );
}
