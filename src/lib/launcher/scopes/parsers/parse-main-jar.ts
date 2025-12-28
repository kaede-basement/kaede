import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/parsers/normalize-artifact-path.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function parseMainJar({
  necessaries,
  client,
}: {
  "necessaries": PreLaunchInformationType;
  "client"     : SpecificPatchMetaType["mainJar"];
}): MappedArtifactType | false {
  const { directories, statuses } = necessaries;
  const name: string | undefined = client?.name;
  const url: string | undefined = client?.downloads?.artifact?.url;

  if (
    client === undefined ||
    name === undefined ||
    url === undefined
  ) {
    statuses.current = LaunchStatus.Errors.ClientMainJarMissingMeta;

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
    url,
    file,
    path,
    directory,
  };
}
