import { LaunchStatus } from "@/constants/launcher.ts";
import { extractNativeArchives } from "@/lib/launcher/scopes/extractors/extract-native-archives.ts";
import {
  extractPreLaunchInformation,
} from "@/lib/launcher/scopes/extractors/extract-pre-launch-information.ts";
import { downloadClient } from "@/lib/launcher/scopes/fetching/download-client.ts";
import { downloadLibraries } from "@/lib/launcher/scopes/fetching/download-libraries.ts";
import { downloadLogging } from "@/lib/launcher/scopes/fetching/download-logging.ts";
import { launch } from "@/lib/launcher/scopes/launch.ts";
import { parseLibraries } from "@/lib/launcher/scopes/parsers/parse-libraries.ts";
import { parseLogging } from "@/lib/launcher/scopes/parsers/parse-logging.ts";
import { parseMainJar } from "@/lib/launcher/scopes/parsers/parse-main-jar.ts";
import {
  ensureMinecraftDirectory,
} from "@/lib/launcher/scopes/validators/ensure-minecraft-directory.ts";
import { getAssets } from "@/lib/launcher/scopes/version-meta/get-assets.ts";
import { getPatches } from "@/lib/launcher/scopes/version-meta/get-patches.ts";
import { getVersionMeta } from "@/lib/launcher/scopes/version-meta/get-version-meta.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

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

  const [
    versionMeta,
  ]: [
    SpecificPatchMetaType | false,
    void,
  ] = await Promise.all([
    getVersionMeta(necessaries),
    ensureMinecraftDirectory(necessaries),
  ]);

  if (versionMeta === false) {
    return false;
  }

  const mainClass: string | undefined = versionMeta?.mainClass;

  if (mainClass === undefined) {
    statuses.current = LaunchStatus.Errors.MetaMissingMainClass;

    return false;
  }

  const { libraries, natives } = parseLibraries({
    necessaries,
    "libraries": versionMeta?.libraries ?? [],
  });
  const logging: (MappedArtifactType & {
    "argument": string;
  }) | false = parseLogging({
    necessaries,
    "logging": versionMeta?.logging,
  });
  const client: MappedArtifactType | false = parseMainJar({
    necessaries,
    "client": versionMeta?.mainJar,
  });

  console.log("parsed:", libraries, natives, logging, client);

  if (client === false) {
    return false;
  }

  // Concurrently resolve instance assets, client jar, libraries, logging configs, and patches
  const [
    assets,
    patches,
  ]: [
    boolean,
    LibraryArtifactsType | false,
    void,
    void,
    void,
  ] = await Promise.all([
    getAssets({ necessaries, versionMeta }),
    getPatches({ necessaries, versionMeta }),
    downloadClient({ necessaries, client, versionMeta }),
    downloadLogging({ necessaries, logging, versionMeta }),
    downloadLibraries({ necessaries, libraries, natives, versionMeta }),
  ]);

  console.log("downloads:", assets, patches);

  if (!assets || !patches) {
    return false;
  }

  await extractNativeArchives({
    necessaries,
    "paths": [
      ...natives.map(({ path }) => path),
      ...patches.natives.map(({ path }) => path),
    ],
  });

  console.log("huh");

  return launch({
    instanceId,
    necessaries,
    versionMeta,
    "parsed": {
      libraries,
      natives,
      logging,
      client,
      patches,
      mainClass,
    },
  });
}
