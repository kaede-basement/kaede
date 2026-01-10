import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function getGameArguments({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<string> {
  const beforeHooksResult: "continue" | string | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string>({
      "scope" : "onGameArgumentsGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Adding game arguments");

  if (finalizedPatch.minecraftArguments === undefined) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not get game arguments from version meta",
    );

    throw new Error("No minecraft arguments found in the version metadata");
  }

  const tweakersList: Array<string> = finalizedPatch["+tweakers"] ?? [];
  const argumentsWithTweakers: Array<string> = [finalizedPatch.minecraftArguments];

  for (const tweaker of tweakersList) {
    argumentsWithTweakers.push(`--tweakClass ${tweaker}`);
  }

  const afterHooksResult: "continue" | string | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string>({
      "scope" : "onGameArgumentsGet",
      "toPass": { argumentsWithTweakers, necessaries, finalizedPatch },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  return argumentsWithTweakers.join(" ");
}
