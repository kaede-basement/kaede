import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { downloadWithProgress } from "@/lib/launcher/scopes/fetching/download-with-progress.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function downloadClient({
  necessaries,
  client,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "client"     : MappedArtifactType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<void> {
  const beforeHooksResult: "continue" | void | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<void>({
      "scope" : "onMinecraftClientGet",
      "toPass": { necessaries, client, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue") {
    return;
  }

  const { statuses } = necessaries;

  statuses.current = LaunchStatus.Client.CheckingIfPresent;
  const fileExists: boolean = await exists(client.path);

  if (!fileExists) {
    await mkdir(client.directory, { "recursive": true });
    await downloadWithProgress({
      "statusScope": LaunchStatus.Client.DownloadingJar,
      "path"       : client.path,
      "url"        : client.url,
      statuses,
    });
  }

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftClientGet",
    "toPass": { necessaries, client, versionMeta },
    "timing": "after",
  });

  statuses.current = LaunchStatus.Client.Done;
}
