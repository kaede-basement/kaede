import ExtensionsManager from "@/lib/extensions-manager";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function getAdditionalStartArguments({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<Array<string>> {
  const additional: Array<string> = [];
  const beforeHooksResult: "continue" | Array<string> | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<string>>({
      "scope" : "onAdditionalStartArgumentsGet",
      "toPass": { additional, necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  return additional;
}
