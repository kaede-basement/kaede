import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { downloadLibraries } from "@/lib/launcher/scopes/fetching/download-libraries.ts";
import { parseLibraries } from "@/lib/launcher/scopes/parsers/parse-libraries.ts";
import { getAssets } from "@/lib/launcher/scopes/version-meta/get-assets.ts";
import { getPatch } from "@/lib/launcher/scopes/version-meta/patch/get-patch.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
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
}): Promise<Array<MappedArtifactType> | false> {
  const beforeHooksResult: "continue" | Array<MappedArtifactType> | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<MappedArtifactType> | false>({
      "scope" : "onMinecraftPatchesGet",
      "toPass": { necessaries, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses } = necessaries;
  const requires: SpecificPatchMetaType["requires"] = versionMeta?.requires;

  if (
    requires === undefined ||
    !Array.isArray(requires)
  ) {
    statuses.current = LaunchStatus.Errors.PatchMissingMeta;

    return false;
  }

  const patches: Array<SpecificPatchMetaType | false> = await Promise.all(
    requires.map(require => getPatch({
      "baseDirectory": directories.base,
      statuses,
      require,
    })),
  );
  const merged: Array<MappedArtifactType> = [];

  for (const patch of patches) {
    if (patch === false) {
      return false;
    }

    const { libraries, natives } = parseLibraries({
      necessaries,
      "libraries": patch?.libraries ?? [],
    });

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

    merged.push(...libraries, ...natives);
  }

  const afterHooksResult: "continue" | Array<MappedArtifactType> | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<MappedArtifactType> | false>({
      "scope" : "onMinecraftPatchesGet",
      "toPass": { necessaries, merged, versionMeta },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  statuses.current = LaunchStatus.Patches.Done;

  return merged;
}
