import General from "@/lib/general";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/parsers/normalize-artifact-path.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

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
  const hash: string | undefined = library?.downloads?.artifact?.sha1;

  if (name === undefined || url === undefined || hash === undefined) {
    log.warn(`The '${name}' library is invalid`);

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
    hash,
  };
}
