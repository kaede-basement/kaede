import {
  shallowlyValidateLibrary,
} from "@/lib/launcher/scopes/libraries/shallowly-validate-library.ts";
import { shouldIncludeLibrary } from "@/lib/launcher/scopes/libraries/should-include-library.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export function getAllowedLibraries({
  necessaries,
  libraries,
}: {
  "necessaries": PreLaunchInformationType;
  "libraries"  : Array<SpecificPatchLibraryType>;
}): Array<SpecificPatchLibraryType> {
  const { statuses } = necessaries;
  const allowed: Array<SpecificPatchLibraryType> = [];

  for (const entry of libraries) {
    const library: SpecificPatchLibraryType | false = shallowlyValidateLibrary({
      "library": entry,
      statuses,
    });

    if (library === false) {
      log.warn(`The '${JSON.stringify(entry)}' library is completely invalid`);

      continue;
    }

    const toInclude: boolean = shouldIncludeLibrary({
      necessaries,
      library,
    });

    if (toInclude) {
      allowed.push(library);
    }
  }

  return allowed;
}
