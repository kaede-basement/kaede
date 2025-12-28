import { mkdir } from "@tauri-apps/plugin-fs";

import { ConcurrentDownloads, LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { downloadWithProgress } from "@/lib/launcher/scopes/download-with-progress.ts";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/normalize-artifact-path.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/libraries/mapped-artifact.type.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function handleLibrariesDownload({
  libraries,
  natives,
  necessaries,
}: {
  "libraries"  : Array<SpecificPatchLibraryType>;
  "natives"    : Array<MappedArtifactType>;
  "necessaries": PreLaunchInformationType;
}): Promise<Array<string>> {
  const { directories, statuses } = necessaries;
  const mappedLibraryArtifacts: Array<MappedArtifactType> = [];

  for (const library of libraries) {
    const url: string | undefined = library?.downloads?.artifact?.url;

    if (url === undefined) {
      continue;
    }

    const { "directory": relativeDirectory, file } = normalizeArtifactPath(library.name);
    const directory: string = General.cachedJoin(
      directories.libraries,
      relativeDirectory,
    );
    const path: string = General.cachedJoin(
      directory,
      file,
    );

    mappedLibraryArtifacts.push({
      path,
      directory,
      file,
      url,
    });
  }

  // Natives should probably end up at the end of the libraries list
  mappedLibraryArtifacts.push(...natives);

  const missingLibraries: Set<string> = new Set(
    await General.getMissingPaths({
      "paths": mappedLibraryArtifacts.map(({ path }) => path),
    }),
  );

  console.log(missingLibraries);

  const missingLibraryArtifacts: Array<MappedArtifactType> = mappedLibraryArtifacts
    .filter(({ path }) => {
      return missingLibraries.has(path);
    });
  const indexReference: { "value": number } = {
    "value": 0,
  };

  log.debug("Initializing library directories");
  await Promise.all(
    missingLibraryArtifacts.map(({ directory }) => mkdir(
      directory,
      { "recursive": true },
    )),
  );

  log.debug("Starting to download libraries");
  await Promise.all(
    Array
      .from({ "length": ConcurrentDownloads.Libraries })
      .map(async (_, groupIndex: number): Promise<void> => {
        while (true) {
          if (indexReference.value >= missingLibraryArtifacts.length) {
            break;
          }

          const entryOutOfTotal = `${indexReference.value + 1}/${missingLibraryArtifacts.length}`;
          const index = indexReference.value++;
          const { url, "path": filePath } = missingLibraryArtifacts[index];

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

  return [];
}
