import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { downloadLibraries } from "@/lib/launcher/scopes/fetching/download-libraries.ts";
import { parseLibraries } from "@/lib/launcher/scopes/parsers/parse-libraries.ts";
import { getAssets } from "@/lib/launcher/scopes/version-meta/get-assets.ts";
import { getPatch } from "@/lib/launcher/scopes/version-meta/patch/get-patch.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getPatches({
  necessaries,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<LibraryArtifactsType | false> {
  const beforeHooksResult: "continue" | LibraryArtifactsType | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<LibraryArtifactsType | false>({
      "scope" : "onMinecraftPatchesGet",
      "toPass": { necessaries, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  log.debug("Getting the patch requires metadata");
  const { directories, statuses } = necessaries;
  const requires: SpecificPatchMetaType["requires"] = versionMeta?.requires;

  if (
    requires === undefined ||
    !Array.isArray(requires)
  ) {
    log.error("The version meta is missing patch requires metadata");
    statuses.current = LaunchStatus.Errors.PatchMissingMeta;

    return false;
  }

  log.debug(`Getting the metadata for ${requires.length} patches`);
  const patches: Array<SpecificPatchMetaType | false> = await Promise.all(
    requires.map(require => getPatch({
      "baseDirectory": directories.base,
      statuses,
      require,
    })),
  );
  const results: LibraryArtifactsType = { "libraries": [], "natives": [] };

  for (const patch of patches) {
    if (patch === false) {
      return false;
    }

    const { libraries, natives } = parseLibraries({
      necessaries,
      "libraries": patch?.libraries ?? [],
    });

    if (patch?.assetIndex === undefined) {
      log.debug(`The '${patch?.uid}' patch does not have assetIndex`);
      await downloadLibraries({
        necessaries,
        libraries,
        natives,
        "versionMeta": patch,
      });

      results.libraries.push(...libraries);
      results.natives.push(...natives);

      continue;
    }

    log.debug(`The '${patch?.uid}' patch has assetIndex`);
    await Promise.all([
      getAssets({
        necessaries,
        "versionMeta": patch,
      }),
      downloadLibraries({
        necessaries,
        libraries,
        natives,
        "versionMeta": patch,
      }),
    ]);

    results.libraries.push(...libraries);
    results.natives.push(...natives);
  }

  const afterHooksResult: "continue" | LibraryArtifactsType | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<LibraryArtifactsType | false>({
      "scope" : "onMinecraftPatchesGet",
      "toPass": { necessaries, results, versionMeta },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  log.info(`Successfully handled ${patches.length} patches`);
  statuses.current = LaunchStatus.Patches.Done;

  return results;
}
