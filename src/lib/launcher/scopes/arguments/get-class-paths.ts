import { writeTextFile } from "@tauri-apps/plugin-fs";

import General from "@/lib/general";
import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
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
  necessaries,
  parsed,
}: {
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : {
    "libraries": Array<MappedArtifactType>;
    "natives"  : Array<MappedArtifactType>;
    "logging"  : (MappedArtifactType & {
      "argument": string;
    }) | false;
    "client"   : MappedArtifactType;
    "patches"  : LibraryArtifactsType;
    "mainClass": string;
  };
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
