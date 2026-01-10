import { writeTextFile } from "@tauri-apps/plugin-fs";

import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

const classPathsFileName: string = "classpaths.txt";

export async function getClassPaths({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<{
  "argument"  : string;
  "classPaths": string;
}> {
  log.debug(
    __PRE_BUNDLED_FILENAME__,
    "Merging all library and client classpaths",
  );
  const { directories, "user": { javaMajor } } = necessaries;
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
    "argument"  : string;
    "classPaths": string;
  } | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<{
      "argument"  : string;
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
  log.debug(__PRE_BUNDLED_FILENAME__, "Removing duplicated classpaths");
  const uniquePaths: Set<string> = new Set(mergedPaths);
  const classPaths: string = [...uniquePaths].join(";");

  if (javaMajor <= 8) {
    log.info(
      __PRE_BUNDLED_FILENAME__,
      "The Java major version is equal to or below 8; using direct classpaths",
    );

    return {
      "argument"  : "-cp ${classpath}",
      "classPaths": classPaths,
    };
  }

  log.info(
    __PRE_BUNDLED_FILENAME__,
    "The Java major version is higher than 8; using @argfile argument",
  );
  const classPathsFilePath: string = General.cachedJoin(
    directories.instance,
    classPathsFileName,
  );

  log.debug(__PRE_BUNDLED_FILENAME__, `Writing @argfile classpaths to '${classPathsFilePath}'`);
  await writeTextFile(
    classPathsFilePath,
    [
      "-cp",
      classPaths,
    ].join("\n"),
  );

  return {
    "argument"  : `@${classPathsFileName}`,
    "classPaths": classPaths,
  };
}
