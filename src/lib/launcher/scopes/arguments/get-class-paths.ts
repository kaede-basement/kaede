import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function getClassPaths({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<{
  "argument"  : [string, string];
  "classPaths": string;
}> {
  const logPrefix = necessaries.logPrefix;

  log.debug(
    logPrefix,
    "Merging all library and client classpaths",
  );
  const mergedPaths: Array<string> = finalizedPatch
    .artifacts
    .filter(({ status }) => (
      (status === "library") || (status === "empty")
    ))
    .map(({ path }) => path);

  if (finalizedPatch.client) {
    mergedPaths.push(finalizedPatch.client.path);
  }

  const beforeHooksResult: "continue" | {
    "argument"  : [string, string];
    "classPaths": string;
  } | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<{
      "argument"  : [string, string];
      "classPaths": string;
    }>({
      "scope" : "onClassPathsGet",
      "toPass": { mergedPaths, necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  // The library paths may have duplicates because of the natives
  log.debug(logPrefix, "Removing duplicated classpaths");
  const uniquePaths: Set<string> = new Set(mergedPaths);
  const classPaths: string = [...uniquePaths].join(";");

  log.info(
    logPrefix,
    `Removed ${mergedPaths.length - uniquePaths.size} duplicated classpaths`,
  );

  return {
    "argument"  : ["-cp", "${classpath}"],
    "classPaths": classPaths,
  };
}
