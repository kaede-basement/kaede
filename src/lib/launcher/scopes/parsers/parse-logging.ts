import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
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
  log.debug(__PRE_BUNDLED_FILENAME__, "Parsing the logging metadata");
  const { directories, statuses } = necessaries;

  if (
    logging === undefined ||
    logging?.type === undefined ||
    logging?.file === undefined ||
    logging?.argument === undefined
  ) {
    log.warn(
      __PRE_BUNDLED_FILENAME__,
      "The 'logging' field is invalid. Contents:",
      "\n" + JSON.stringify(logging, null, 2),
    );
    statuses.current = LaunchStatus.Errors.LoggingMissingMeta;

    return false;
  }

  // Already contains an extension (.xml)
  const name: string | undefined = logging.file?.id;
  const url: string | undefined = logging.file?.url;
  const hash: string | undefined = logging.file?.sha1;

  if (!name || !url || !hash) {
    log.warn(__PRE_BUNDLED_FILENAME__, "Missing the logging config file metadata");
    statuses.current = LaunchStatus.Errors.LoggingMissingMeta;

    return false;
  }

  const path = General.cachedJoin(
    directories.logging,
    name,
  );

  log.debug(__PRE_BUNDLED_FILENAME__, "Parsed the logging metadata");

  return {
    "file"     : name,
    "path"     : path,
    "url"      : url,
    "hash"     : hash,
    "argument" : logging.argument,
    "directory": directories.logging,
  };
}
