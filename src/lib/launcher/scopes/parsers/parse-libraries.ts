import { checkIsNative } from "@/lib/launcher/scopes/parsers/check-is-native.ts";
import { parseLibrary } from "@/lib/launcher/scopes/parsers/parse-library.ts";
import { parseNative } from "@/lib/launcher/scopes/parsers/parse-native.ts";
import {
  shallowlyValidateLibrary,
} from "@/lib/launcher/scopes/validators/shallowly-validate-library.ts";
import { shouldIncludeLibrary } from "@/lib/launcher/scopes/parsers/should-include-library.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/libraries/mapped-artifact.type.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export function parseLibraries({
  necessaries,
  libraries,
}: {
  "necessaries": PreLaunchInformationType;
  "libraries"  : Array<SpecificPatchLibraryType>;
}): {
  "libraries": Array<MappedArtifactType>;
  "natives"  : Array<MappedArtifactType>;
} {
  const { statuses } = necessaries;
  const results: {
    "libraries": Array<MappedArtifactType>;
    "natives"  : Array<MappedArtifactType>;
  } = {
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
    const artifact: MappedArtifactType | false = isNative
      ? parseLibrary({ necessaries, library })
      : parseNative({ necessaries, library });

    if (!artifact) {
      continue;
    }

    if (isNative) {
      results.natives.push(artifact);
    } else {
      results.libraries.push(artifact);
    }
  }

  return results;
}
