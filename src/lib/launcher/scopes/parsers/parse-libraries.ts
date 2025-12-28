import { checkIsNative } from "@/lib/launcher/scopes/parsers/check-is-native.ts";
import { parseLibrary } from "@/lib/launcher/scopes/parsers/parse-library.ts";
import { parseNative } from "@/lib/launcher/scopes/parsers/parse-native.ts";
import { shouldIncludeLibrary } from "@/lib/launcher/scopes/parsers/should-include-library.ts";
import {
  shallowlyValidateLibrary,
} from "@/lib/launcher/scopes/validators/shallowly-validate-library.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function parseLibraries({
  necessaries,
  libraries,
}: {
  "necessaries": PreLaunchInformationType;
  "libraries"  : Array<SpecificPatchLibraryType>;
}): LibraryArtifactsType {
  const { statuses } = necessaries;
  const results: LibraryArtifactsType = {
    "libraries": [],
    "natives"  : [],
  };

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

    if (!toInclude) {
      log.debug(`The '${library?.name}' library was not included (incompatible)`);

      continue;
    }

    const isNative: boolean = checkIsNative(library);

    const libraryArtifact: MappedArtifactType | false = parseLibrary({ necessaries, library });
    const nativeArtifact: MappedArtifactType | false = isNative
      ? parseNative({ necessaries, library })
      : false;

    if (libraryArtifact) {
      results.libraries.push(libraryArtifact);
    }

    if (nativeArtifact) {
      results.natives.push(nativeArtifact);
    }
  }

  return results;
}
