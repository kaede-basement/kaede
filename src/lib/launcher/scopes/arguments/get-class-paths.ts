import { writeTextFile } from "@tauri-apps/plugin-fs";

import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type { ParsedMetaType } from "@/types/launcher/meta/parsed-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

function mapPaths(artifacts: Array<MappedArtifactType>): Array<string> {
  return artifacts
    .map(({ path }) => path);
}

const classPathsFileName: string = "classpaths.txt";

export async function getClassPaths({
  instanceId,
  necessaries,
  versionMeta,
  parsed,
}: {
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : ParsedMetaType;
}): Promise<{
  "argument"  : string;
  "classPaths": string;
}> {
  log.debug("Merging all library, native, and main jar paths for classpaths");
  const { directories, javaMajor } = necessaries;
  const mergedPaths: Array<string> = [
    ...mapPaths(parsed.libraries),
    ...mapPaths(parsed.natives),
    ...mapPaths(parsed.patches.libraries),
    ...mapPaths(parsed.patches.natives),
    parsed.client.path,
  ];

  const beforeHooksResult: "continue" | {
    "argument"  : string;
    "classPaths": string;
  } | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<{
      "argument"  : string;
      "classPaths": string;
    }>({
      "scope" : "onClassPathsGet",
      "toPass": { mergedPaths, instanceId, necessaries, versionMeta, parsed },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  // The library paths may have duplicates because of the natives
  log.debug("Removing duplicated classpaths");
  const uniquePaths: Set<string> = new Set(mergedPaths);
  const classPaths: string = [...uniquePaths].join(";");

  if (javaMajor <= 8) {
    log.info("The Java major version is equal to or below 8; using direct classpaths");

    return {
      "argument"  : "-cp ${classpath}",
      "classPaths": classPaths,
    };
  }

  log.info("The Java major version is higher than 8; using @argfile argument");
  const classPathsFilePath: string = General.cachedJoin(
    directories.instance,
    classPathsFileName,
  );

  log.debug(`Writing @argfile classpaths to '${classPathsFilePath}'`);
  await writeTextFile(
    classPathsFilePath,
    [
      "-cp",
      classPaths,
    ].join("\n"),
  );

  return {
    "argument"  : `@${classPathsFileName}`,
    "classPaths": classPaths,
  };
}
