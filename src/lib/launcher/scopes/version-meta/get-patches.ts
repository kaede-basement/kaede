import { LaunchStatus } from "@/constants/launcher.ts";
import { getPatch } from "@/lib/launcher/scopes/version-meta/patch/get-patch.ts";
import { getAssets } from "@/lib/launcher/scopes/version-meta/get-assets.ts";
import { getLibraries } from "@/lib/launcher/scopes/version-meta/get-libraries.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function getPatches({
  necessaries,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<Array<string> | false> {
  const { directories, statuses } = necessaries;
  const requires: SpecificPatchMetaType["requires"] = versionMeta?.requires;

  if (
    requires === undefined ||
    !Array.isArray(requires)
  ) {
    statuses.add(LaunchStatus.Errors.PatchMissingMeta);

    return false;
  }

  const patches: Array<SpecificPatchMetaType | false> = await Promise.all(
    requires.map(require => getPatch({
      "baseDirectory": directories.base,
      statuses,
      require,
    })),
  );
  const libraryPaths: Array<string> = [];

  for (const patch of patches) {
    if (patch === false) {
      return false;
    }

    const [libraries] = await Promise.all([
      getLibraries({
        necessaries,
        "versionMeta": patch,
      }),
      getAssets({
        necessaries,
        "versionMeta": patch,
      }),
    ]);

    if (!libraries) {
      continue;
    }

    libraryPaths.push(...libraries);
  }

  return libraryPaths;
}
