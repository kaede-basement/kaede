import { LaunchStatus } from "@/constants/launcher.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function shallowlyValidateLibrary({
  statuses,
  library,
}: {
  "statuses": LauncherStatusesType;
  "library" : unknown;
}): SpecificPatchLibraryType | false {
  if (
    typeof library !== "object" ||
    library === null ||
    !("name" in library)
  ) {
    log.debug(`The '${JSON.stringify(library)}' is completely incompatible`);
    statuses.current = LaunchStatus.Errors.LibraryShallowValidationFailed;

    return false;
  }

  return library as SpecificPatchLibraryType;
}
