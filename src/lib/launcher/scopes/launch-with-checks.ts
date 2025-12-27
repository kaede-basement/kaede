import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import {
  extractPreLaunchInformation,
} from "@/lib/launcher/scopes/extract-pre-launch-information.ts";
import { getVersionMeta } from "@/lib/launcher/scopes/get-version-meta.ts";
import { launch } from "@/lib/launcher/scopes/launch.ts";
import { getAssets } from "@/lib/launcher/scopes/version-meta/get-assets.ts";
import { getClient } from "@/lib/launcher/scopes/version-meta/get-client.ts";
import { getLibraries } from "@/lib/launcher/scopes/version-meta/get-libraries.ts";
import { getLogging } from "@/lib/launcher/scopes/version-meta/get-logging.ts";
import { getPatches } from "@/lib/launcher/scopes/version-meta/get-patches.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function launchWithChecks({
  instanceId,
  statuses,
}: {
  "instanceId": string;
  "statuses"  : LauncherStatusesType;
}): Promise<boolean> {
  const necessaries: PreLaunchInformationType | false = extractPreLaunchInformation({
    instanceId,
    statuses,
  });

  if (necessaries === false) {
    return false;
  }

  const versionMeta: SpecificPatchMetaType | undefined = await getVersionMeta(necessaries);

  if (versionMeta === undefined) {
    return false;
  }

  const {
    assetIndex,
    mainJar,
    libraries,
    logging,
    requires,
  } = versionMeta;

  // Concurrently resolve instance assets, client jar, libraries, logging configs, and patches
  const [
    assetsDirectory,
    clientDirectory,
    loggingDirectory,
    libraryPaths,
    patchPaths,
  ]: [
    string | false,
    string | false,
    string | false,
    string | false,
    string | false,
  ] = await Promise.all([
    getAssets({ baseDirectory, assetIndex, statuses }),
    getClient({ baseDirectory, mainJar, statuses }),
    getLogging({ baseDirectory, logging, statuses }),
    getLibraries({ baseDirectory, libraries, statuses }),
    getPatches({ baseDirectory, requires, statuses }),
  ]);

  if (
    !assetsDirectory ||
    !clientDirectory ||
    !loggingDirectory ||
    !libraryPaths ||
    !patchPaths
  ) {
    return false;
  }

  const nativesDirectory: string = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Instances.Path,
    instanceId,
    "natives",
  );

  return launch({
    instanceId,
    instance,
    versionMeta,
    statuses,
    "directories": {
      "base"     : baseDirectory,
      "instance" : instanceDirectory,
      "natives"  : nativesDirectory,
      "assets"   : assetsDirectory,
      "client"   : clientDirectory,
      "logging"  : loggingDirectory,
      "libraries": libraryPaths,
      "patches"  : patchPaths,
    },
  });
}
