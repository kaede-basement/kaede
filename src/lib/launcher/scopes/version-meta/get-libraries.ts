import { LaunchStatus } from "@/constants/launcher.ts";
import {
  shallowlyValidateLibrary,
} from "@/lib/launcher/scopes/libraries/shallowly-validate-library.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type {
  SpecificPatchLibraryType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getLibraries({
  baseDirectory,
  libraries,
  statuses,
}: {
  "baseDirectory": string;
  "libraries"    : SpecificPatchMetaType["libraries"];
  "statuses"     : LauncherStatusesType;
}): Promise<string | false> {
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
