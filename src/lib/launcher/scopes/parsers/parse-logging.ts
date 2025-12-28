import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function parseLogging({
  necessaries,
  logging,
}: {
  "necessaries": PreLaunchInformationType;
  "logging"    : SpecificPatchMetaType["logging"];
}): (MappedArtifactType & {
  "argument": string;
}) | false {
  const { directories, statuses } = necessaries;

  if (
    logging === undefined ||
    logging?.type === undefined ||
    logging?.file === undefined ||
    logging?.argument === undefined
  ) {
    statuses.current = LaunchStatus.Errors.LoggingMissingMeta;

    return false;
  }

  // Already contains an extension (.xml)
  const name: string | undefined = logging.file?.id;
  const url: string | undefined = logging?.file?.url;

  if (!name || !url) {
    statuses.current = LaunchStatus.Errors.LoggingMissingMeta;

    return false;
  }

  const path = General.cachedJoin(
    directories.logging,
    name,
  );

  return {
    "file"     : name,
    "path"     : path,
    "url"      : url,
    "argument" : logging.argument,
    "directory": directories.logging,
  };
}
