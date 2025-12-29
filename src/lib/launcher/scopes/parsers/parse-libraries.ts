import ExtensionsManager from "@/lib/extensions-manager";
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
  const beforeHooksResult: "continue" | LibraryArtifactsType | undefined =
    ExtensionsManager.catchSyncResponseHooks<LibraryArtifactsType>({
      "scope" : "onLibrariesParsing",
      "toPass": { necessaries, libraries },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { statuses } = necessaries;
  const results: LibraryArtifactsType = {
    "libraries": [],
    "natives"  : [],
  };

  log.debug(`Parsing ${libraries.length} libraries`);
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

  const afterHooksResult: "continue" | LibraryArtifactsType | undefined =
    ExtensionsManager.catchSyncResponseHooks<LibraryArtifactsType>({
      "scope" : "onLibrariesParsing",
      "toPass": {
        necessaries,
        "unparsed": libraries,
        "parsed"  : results,
      },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  log.debug(`Got ${results.libraries.length}/${libraries.length} libraries`);
  log.debug(`Got ${results.natives.length} natives`);

  return results;
}
