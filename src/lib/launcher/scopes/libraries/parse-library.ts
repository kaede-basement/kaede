import General from "@/lib/general";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/normalize-artifact-path.ts";
import type { MappedArtifactType } from "@/types/launcher/libraries/mapped-artifact.type.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export function parseLibrary({
  necessaries,
  library,
}: {
  "necessaries": PreLaunchInformationType;
  "library"    : SpecificPatchLibraryType;
}): MappedArtifactType | false {
  const { directories } = necessaries;
  const name: string | undefined = library?.name;
  const url: string | undefined = library?.downloads?.artifact?.url;

  if (name === undefined || url === undefined) {
    return false;
  }

  const { "directory": relativeDirectory, file } = normalizeArtifactPath(name);
  const directory: string = General.cachedJoin(
    directories.libraries,
    relativeDirectory,
  );
  const path: string = General.cachedJoin(
    directory,
    file,
  );

  return {
    directory,
    file,
    url,
    path,
  };
}
