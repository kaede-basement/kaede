import { writeTextFile } from "@tauri-apps/plugin-fs";

import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
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

  // The libraries paths may have duplicates because of the natives
  const uniquePaths: Set<string> = new Set(mergedPaths);
  const classPaths: string = [...uniquePaths].join(";");

  if (javaMajor <= 8) {
    return {
      "argument"  : "-cp ${classpath}",
      "classPaths": classPaths,
    };
  }

  const classPathsFilePath: string = General.cachedJoin(
    directories.instance,
    classPathsFileName,
  );

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
