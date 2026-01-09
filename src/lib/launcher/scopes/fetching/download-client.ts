import { mkdir } from "@tauri-apps/plugin-fs";

import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { downloadWithProgress } from "@/lib/launcher/scopes/fetching/download-with-progress.ts";
import { verifyArtifacts } from "@/lib/launcher/scopes/validators/verify-artifacts.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function downloadClient({
  necessaries,
  client,
  versionMeta,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  const beforeHooksResult: "continue" | void | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<void>({
      "scope" : "onMinecraftClientGet",
      "toPass": { necessaries, client, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue") {
    return;
  }

  const { statuses, instance } = necessaries;

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Checking if the main jar exists. SHA1 checks enabled: ${instance.checksum}`,
  );
  statuses.current = LaunchStatus.Client.CheckingIfPresent;
  const mismatches: Array<string> = await verifyArtifacts({
    "paths"   : [client],
    "checksum": instance.checksum,
  });
  const isMismatch: boolean = mismatches.length > 0;

  if (isMismatch) {
    log.warn(
      __PRE_BUNDLED_FILENAME__,
      `The main jar is not valid. SHA1 checks enabled: ${instance.checksum}`,
    );
    log.debug(__PRE_BUNDLED_FILENAME__, "Making a directory for the main jar");
    await mkdir(client.directory, { "recursive": true });
    log.debug(__PRE_BUNDLED_FILENAME__, "Downloading the main jar");
    await downloadWithProgress({
      "statusScope": LaunchStatus.Client.DownloadingJar,
      "path"       : client.path,
      "url"        : client.url,
      statuses,
    });
  } else {
    log.info(
      __PRE_BUNDLED_FILENAME__,
      `The main jar is valid. SHA1 checks enabled: ${instance.checksum}`,
    );
  }

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftClientGet",
    "toPass": { necessaries, client, versionMeta },
    "timing": "after",
  });

  log.info(__PRE_BUNDLED_FILENAME__, "Successfully handled the main jar");
  statuses.current = LaunchStatus.Client.Done;
}
