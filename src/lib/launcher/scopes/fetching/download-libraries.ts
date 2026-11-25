import { GeneralSettings, LaunchStatus } from "@/constants/launcher.ts";
import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

import { downloadMissing } from "./download-missing.ts";

export async function downloadLibraries({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  const beforeHooksResult: "continue" | boolean | undefined =
    await Hooks.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftLibrariesGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { statuses, instance, logPrefix, cancelId } = necessaries;
  const artifacts: Array<MappedArtifactType> = finalizedPatch
    .artifacts
    .filter(({ status }) => status !== "empty");

  const report = await downloadMissing({
    statuses,
    cancelId,
    "entries"    : artifacts,
    "checksum"   : instance.checksum,
    "concurrency": GeneralSettings.ConcurrentDownloads.Libraries,
    "label"      : "libraries",
  });

  if (report.failed > 0 || report.cancelled) {
    return false;
  }

  await Hooks.catchAsyncVoidHooks({
    "scope" : "onMinecraftLibrariesGet",
    "toPass": { necessaries, finalizedPatch },
    "timing": "after",
  });

  log.info(
    logPrefix,
    `Successfully handled ${artifacts.length} libraries`,
  );
  statuses.current = LaunchStatus.Libraries.Success;

  return true;
}
