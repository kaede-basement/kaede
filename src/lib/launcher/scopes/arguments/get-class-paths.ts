import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

function mergePaths(artifacts: Array<MappedArtifactType>): string {
  return artifacts
    .map(({ path }) => path)
    .join(";");
}

export async function getClassPaths({
  parsed,
}: {
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : {
    "libraries": Array<MappedArtifactType>;
    "natives"  : Array<MappedArtifactType>;
    "logging"  : MappedArtifactType & {
      "argument": string;
    };
    "client"   : MappedArtifactType;
    "patches"  : LibraryArtifactsType;
    "mainClass": string;
  };
}): Promise<{
  "argument"  : string;
  "classPaths": string;
}> {
  const libraries: string = mergePaths(parsed.libraries);
  const natives: string = mergePaths(parsed.natives);
  const patchLibraries: string = mergePaths(parsed.patches.libraries);
  const patchNatives: string = mergePaths(parsed.patches.natives);
  const classPaths: string = [
    libraries,
    natives,
    patchLibraries,
    patchNatives,
    parsed.client.path,
  ].join(";");

  return {
    "argument"  : "-cp ${classpath}",
    "classPaths": classPaths,
  };
}
