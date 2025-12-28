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
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function launchWithChecks({
  instanceId,
  instance,
  statuses,
}: {
  "instanceId": string;
  "instance"  : InstanceStateType;
  "statuses"  : LauncherStatusesType;
}): Promise<boolean> {
  const necessaries: PreLaunchInformationType | false = extractPreLaunchInformation({
    instanceId,
    instance,
    statuses,
  });

  if (necessaries === false) {
    return false;
  }

  const versionMeta: SpecificPatchMetaType | false = await getVersionMeta(necessaries);

  if (versionMeta === false) {
    return false;
  }

  // Concurrently resolve instance assets, client jar, libraries, logging configs, and patches
  const [
    assets,
    client,
    logging,
    libraries,
    patches,
  ]: [
    boolean,
    string | false,
    boolean,
    Array<string> | false,
    Array<string> | false,
  ] = await Promise.all([
    getAssets({ necessaries, versionMeta }),
    getClient({ necessaries, versionMeta }),
    getLogging({ necessaries, versionMeta }),
    getLibraries({ necessaries, versionMeta }),
    getPatches({ necessaries, versionMeta }),
  ]);

  if (
    !assets ||
    !client ||
    !logging ||
    !libraries ||
    !patches
  ) {
    return false;
  }

  return launch({
    instanceId,
    client,
    necessaries,
    versionMeta,
  });
}
