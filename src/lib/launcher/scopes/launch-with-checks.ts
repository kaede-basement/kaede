import { LaunchStatus } from "@/constants/launcher.ts";
import General from "@/lib/general";
import { extractInstanceVersion } from "@/lib/launcher/scopes/extract-instance-version.ts";
import { getVersionMeta } from "@/lib/launcher/scopes/get-version-meta.ts";
import { getAssets } from "@/lib/launcher/scopes/version-meta/get-assets.ts";
import { getClient } from "@/lib/launcher/scopes/version-meta/get-client.ts";
import { getLibraries } from "@/lib/launcher/scopes/version-meta/get-libraries.ts";
import { getLogging } from "@/lib/launcher/scopes/version-meta/get-logging.ts";
import { getPatches } from "@/lib/launcher/scopes/version-meta/get-patches.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta-manifest.type.ts";

export async function launchWithChecks({
  instanceId,
  statuses,
}: {
  "instanceId": string;
  "statuses"  : LauncherStatusesType;
}): Promise<void> {
  statuses.add(LaunchStatus.General.Starting);

  const baseDirectory = General.getCachedBaseDirectory();
  const version = extractInstanceVersion({
    statuses,
    instanceId,
  });

  if (!version) {
    return;
  }

  const versionMeta: MetaMinecraftVersionType | undefined = await getVersionMeta({
    statuses,
    baseDirectory,
    version,
  });

  if (versionMeta === undefined) {
    return;
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
    librariesDirectory,
    loggingDirectory,
    patchesDirectory,
  ]: [
    string | false,
    string | false,
    string | false,
    string | false,
    string | false,
  ] = await Promise.all([
    getAssets({ baseDirectory, assetIndex, statuses }),
    getClient({ baseDirectory, mainJar, statuses }),
    getLibraries({ baseDirectory, libraries, statuses }),
    getLogging({ baseDirectory, logging, statuses }),
    getPatches({ baseDirectory, requires, statuses }),
  ]);

  console.log(
    assetsDirectory,
    clientDirectory,
    librariesDirectory,
    loggingDirectory,
    patchesDirectory,
  );

  if (
    !assetsDirectory ||
    !clientDirectory ||
    !librariesDirectory ||
    !loggingDirectory ||
    !patchesDirectory
  ) {
    return;
  }

  statuses.add(LaunchStatus.General.Success);
}
