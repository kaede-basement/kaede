import { LaunchStatus } from "@/constants/launcher.ts";
import {
  shallowlyValidateLibrary,
} from "@/lib/launcher/scopes/libraries/shallowly-validate-library.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  SpecificPatchLibraryType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function getLibraries({
  necessaries,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<Array<string> | false> {
  const { directories, statuses } = necessaries;
  const libraries: SpecificPatchMetaType["libraries"] = versionMeta?.libraries;

  if (
    libraries === undefined ||
    !Array.isArray(libraries)
  ) {
    statuses.add(LaunchStatus.Errors.LibrariesMissingMeta);

    return false;
  }

  for (const entry of libraries) {
    const library: SpecificPatchLibraryType | false = shallowlyValidateLibrary({
      "library": entry,
      statuses,
    });

    if (library === false) {
      log.warn(`The '${JSON.stringify(entry)}' library is completely invalid`);

      continue;
    }


  }
}
