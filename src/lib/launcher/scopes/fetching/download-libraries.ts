import { mkdir } from "@tauri-apps/plugin-fs";

import { ConcurrentDownloads, LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { verifyArtifacts } from "@/lib/launcher/scopes/validators/verify-artifacts.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function downloadLibraries({
  necessaries,
  libraries,
  natives,
  versionMeta,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  const beforeHooksResult: "continue" | void | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<void>({
      "scope" : "onMinecraftLibrariesGet",
      "toPass": { necessaries, libraries, natives, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue") {
    return;
  }

  const { statuses, instance } = necessaries;
  const merged: Array<MappedArtifactType> = [
    ...libraries,
    ...natives,
  ];

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Verifying ${merged.length} libraries for their existence.`,
    `SHA1 checks enabled: ${instance.checksum}`,
  );
  const startTime: number = performance.now();
  const missing: Set<string> = new Set(
    await verifyArtifacts({
      "paths"   : merged,
      "checksum": instance.checksum,
    }),
  );
  const endTime: number = performance.now();
  const totalTime: string = (endTime - startTime).toFixed(2);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Successfully verified ${merged.length} libraries in ${totalTime} ms.`,
    `Total mismatches: ${missing.size}.`,
    `SHA1 checks enabled: ${instance.checksum}`,
  );

  const missingArtifacts: Array<MappedArtifactType> = merged
    .filter(({ path }) => {
      return missing.has(path);
    });

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing missing library and native directories");
  await Promise.all(
    missingArtifacts.map(({ directory }) => mkdir(
      directory,
      { "recursive": true },
    )),
  );

  await General.concurrentlyDownload({
    statuses,
    "concurrency": ConcurrentDownloads.Libraries,
    "entries"    : missingArtifacts,
    "statusScope": LaunchStatus.Libraries.DownloadingLibrary,
  });
  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftLibrariesGet",
    "toPass": { necessaries, libraries, natives, versionMeta },
    "timing": "after",
  });

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Successfully handled ${merged.length} libraries`,
    `and re-downloaded ${missing.size} of them`,
  );
  statuses.current = LaunchStatus.Libraries.Done;
}
