import {
  extractPreLaunchInformation,
} from "@/lib/launcher/scopes/extractors/extract-pre-launch-information.ts";
import { getVersionMeta } from "@/lib/launcher/scopes/version-meta/get-version-meta.ts";
import { launch } from "@/lib/launcher/scopes/launch.ts";
import { downloadLibraries } from "@/lib/launcher/scopes/fetching/download-libraries.ts";
import { extractNativeArchives } from "@/lib/launcher/scopes/extractors/extract-native-archives.ts";
import { parseLibraries } from "@/lib/launcher/scopes/parsers/parse-libraries.ts";
import { getAssets } from "@/lib/launcher/scopes/version-meta/get-assets.ts";
import { getClient } from "@/lib/launcher/scopes/version-meta/get-client.ts";
import { getLogging } from "@/lib/launcher/scopes/version-meta/get-logging.ts";
import { getPatches } from "@/lib/launcher/scopes/version-meta/get-patches.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/meta/pre-launch-information.type.ts";

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

  const { libraries, natives } = parseLibraries({
    necessaries,
    "libraries": versionMeta?.libraries ?? [],
  });

  // Concurrently resolve instance assets, client jar, libraries, logging configs, and patches
  const [
    assets,
    client,
    logging,
    patches,
  ]: [
    boolean,
    string | false,
    boolean,
    Array<string> | false,
    void,
  ] = await Promise.all([
    getAssets({ necessaries, versionMeta }),
    getClient({ necessaries, versionMeta }),
    getLogging({ necessaries, versionMeta }),
    getPatches({ necessaries, versionMeta }),
    downloadLibraries({ necessaries, libraries, natives }),
  ]);

  await extractNativeArchives({
    necessaries,
    "paths": natives.map(({ path }) => path),
  });

  if (
    !assets ||
    !client ||
    !logging ||
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
