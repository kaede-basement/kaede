import { LaunchStatus } from "@/constants/launcher.ts";
import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

import { downloadMissing } from "./download-missing.ts";

export async function downloadClient({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  const beforeHooksResult: "continue" | boolean | undefined =
    await Hooks.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftClientGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const client = finalizedPatch.client;

  if (client === false) {
    return false;
  }

  const { statuses, instance, logPrefix, cancelId } = necessaries;

  log.debug(
    logPrefix,
    `Checking if the main jar exists. SHA1 checks enabled: ${instance.checksum}`,
  );
  statuses.current = LaunchStatus.Client.Checking;
  const report = await downloadMissing({
    statuses,
    cancelId,
    "entries"    : [client],
    "checksum"   : instance.checksum,
    "concurrency": 1,
    "label"      : "client",
  });

  if (report.failed > 0 || report.cancelled) {
    return false;
  }

  await Hooks.catchAsyncVoidHooks({
    "scope" : "onMinecraftClientGet",
    "toPass": { necessaries, finalizedPatch },
    "timing": "after",
  });

  log.info(logPrefix, "Successfully handled the main jar");
  statuses.current = LaunchStatus.Client.Success;

  return true;
}
