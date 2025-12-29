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

export async function downloadLibraries({
  necessaries,
  libraries,
  natives,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "libraries"  : Array<MappedArtifactType>;
  "natives"    : Array<MappedArtifactType>;
  "versionMeta": SpecificPatchMetaType;
}): Promise<void> {
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
  const missing: Set<string> = new Set(
    await verifyArtifacts({
      "paths"   : merged,
      "checksum": instance.checksum,
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

  statuses.current = LaunchStatus.Libraries.Done;
}
