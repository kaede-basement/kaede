import { LaunchStatus } from "@/constants/launcher.ts";
import Hooks from "@/lib/hooks";
import { log } from "@/lib/logging/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

import { downloadMissing } from "./download-missing.ts";

export async function downloadLogging({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  const logPrefix = necessaries.logPrefix;
  const logging = finalizedPatch.logging;

  if (logging === false) {
    log.warn(
      logPrefix,
      "No logging field found. Perhaps, the instance version is pre-1.7?",
    );
    necessaries.statuses.current = LaunchStatus.Logging.Success;

    return true;
  }

  const beforeHooksResult: "continue" | boolean | undefined =
    await Hooks.catchAsyncResponseHooks<boolean>({
      "scope" : "onMinecraftLoggingGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { statuses, instance, cancelId } = necessaries;

  statuses.current = LaunchStatus.Logging.Checking;
  const report = await downloadMissing({
    statuses,
    cancelId,
    "entries"    : [logging],
    "checksum"   : instance.checksum,
    "concurrency": 1,
    "label"      : "logging",
  });

  if (report.failed > 0 || report.cancelled) {
    return false;
  }

  await Hooks.catchAsyncVoidHooks({
    "scope" : "onMinecraftLoggingGet",
    "toPass": { necessaries, finalizedPatch },
    "timing": "after",
  });

  log.info(logPrefix, "Successfully handled the logging config");
  statuses.current = LaunchStatus.Logging.Success;

  return true;
}
