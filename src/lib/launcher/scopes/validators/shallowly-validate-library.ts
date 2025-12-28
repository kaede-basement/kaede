import { LaunchStatus } from "@/constants/launcher.ts";
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
    statuses.current = LaunchStatus.Errors.LibraryShallowValidationFailed;

    return false;
  }

  return library as SpecificPatchLibraryType;
}
