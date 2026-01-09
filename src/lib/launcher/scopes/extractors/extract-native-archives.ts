import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function extractNativeArchives({
  necessaries,
  paths,
}: {
  "necessaries": PreLaunchInformationType;
  "paths"      : Array<string>;
}): Promise<void> {
  const beforeHooksResult: "continue" | void | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<void>({
      "scope" : "onNativesExtract",
      "toPass": { necessaries, paths },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue") {
    return;
  }

  const { directories } = necessaries;

  log.debug(__PRE_BUNDLED_FILENAME__, `Extracting ${paths.length} native archives`);
  const startTime: number = performance.now();

  await Promise.all(
    paths.map(path => General.unzip({
      "from": path,
      "to"  : directories.natives,
    })),
  );

  const endTime: number = performance.now();
  const totalTime: string = (endTime - startTime).toFixed(2);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Successfully extracted ${paths.length} native archives in ${totalTime} ms`,
  );

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onNativesExtract",
    "toPass": { necessaries, paths },
    "timing": "after",
  });
}
