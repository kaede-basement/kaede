import { LaunchStatus } from "@/constants/launcher.ts";
import { getPatch } from "@/lib/launcher/scopes/patches/get-patch.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function getPatches({
  necessaries,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<string | false> {
  const { directories, statuses } = necessaries;
  const conflicts: SpecificPatchMetaType["conflicts"] = versionMeta?.conflicts;
  const requires: SpecificPatchMetaType["requires"] = versionMeta?.requires;

  if (
    requires === undefined ||
    !Array.isArray(requires)
  ) {
    statuses.add(LaunchStatus.Errors.PatchMissingMeta);

    return false;
  }

  const patches: Array<object> = await Promise.all(
    requires.map(require => getPatch({
      "baseDirectory": directories.base,
      statuses,
      require,
    })),
  );

  return "";
}
