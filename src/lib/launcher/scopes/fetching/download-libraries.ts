import { GeneralSettings, LaunchStatus } from "@/constants/launcher.ts";
import FileManager from "@/lib/file-manager";
import { Algorithms } from "@/lib/hashing.ts";
import Hooks from "@/lib/hooks";
import { extractLaunchWrapper } from "@/lib/launcher/scopes/optifine/extract-launchwrapper.ts";
import { inspectOptiFineJar } from "@/lib/launcher/scopes/optifine/inspect-optifine-jar.ts";
import { log } from "@/lib/logging/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

import { downloadEntries, findMissingEntries } from "./download-missing.ts";

export async function downloadLibraries({
  necessaries,
  finalizedPatch,
  signal,
}: {
  "signal"?       : AbortSignal;
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<boolean> {
  if (signal?.aborted) {
    return false;
  }

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

  const missing = await findMissingEntries(artifacts, instance.checksum, signal);
  const report = await downloadEntries({
    statuses,
    cancelId,
    "entries"    : missing.filter(({ url }) => url !== ""),
    "concurrency": GeneralSettings.ConcurrentDownloads.Libraries,
    "label"      : "libraries",
  }, signal);

  if (report.failed > 0 || report.cancelled || signal?.aborted) {
    return false;
  }

  const local = missing.filter(({ url }) => url === "");

  if (local.length > 0) {
    const algorithm = instance.checksum ? Algorithms.SHA1 : undefined;
    const source = artifacts.find(({ id }) => id === "optifine:OptiFine");
    const bundled = source && await inspectOptiFineJar({
      "jarPath": source.path,
      "label"  : logPrefix,
    });
    const wrapper = local.find(({ id, file }) => {
      return bundled && id === "net.minecraft:launchwrapper" && file === bundled.entryPath;
    });

    if (!source || !bundled || !wrapper || local.length !== 1) {
      const paths = local.map(({ path }) => path).join(", ");

      throw new Error(`Unable to restore missing local libraries: ${paths}`);
    }

    if (signal?.aborted) {
      return false;
    }

    const restored = await extractLaunchWrapper({
      "jarPath"           : source.path,
      "librariesDirectory": necessaries.directories.libraries,
      bundled,
      "label"             : logPrefix,
    });

    if (restored !== wrapper.path) {
      return false;
    }

    const invalid = await FileManager.verifyPaths({ "paths": [wrapper], algorithm });

    if (invalid.length > 0) {
      return false;
    }
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
