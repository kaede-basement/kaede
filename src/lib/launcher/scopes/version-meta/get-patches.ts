import { LaunchStatus } from "@/constants/launcher.ts";
import { getPatch } from "@/lib/launcher/scopes/patches/get-patch.ts";
import type {
  LauncherStatusesType,
} from "@/types/launcher/launch-status.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getPatches({
  baseDirectory,
  requires,
  statuses,
}: {
  "baseDirectory": string;
  "requires"     : SpecificPatchMetaType["requires"];
  "statuses"     : LauncherStatusesType;
}): Promise<string | false> {
  if (
    requires === undefined ||
    !Array.isArray(requires)
  ) {
    statuses.add(LaunchStatus.Errors.PatchMissingMeta);

    return false;
  }

  const patches: Array<object> = await Promise.all(
    requires.map(require => getPatch({
      baseDirectory,
      statuses,
      require,
    })),
  );

  return "";
}
