import ExtensionsManager from "@/lib/extensions-manager";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function getAdditionalStartArguments({
  javaBinary,
  necessaries,
  finalizedPatch,
}: {
  "javaBinary"    : string;
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<string> {
  const beforeHooksResult: "continue" | string | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string>({
      "scope" : "onAdditionalStartArgumentsGet",
      "toPass": { javaBinary, necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const actualJavaBinary: string = necessaries.user.javaBinary;
  const handledJavaBinary: string = actualJavaBinary.includes("bin")
    ? `"${actualJavaBinary}"`
    : actualJavaBinary;

  return javaBinary === "cmd" ? `/C ${handledJavaBinary}` : "";
}
