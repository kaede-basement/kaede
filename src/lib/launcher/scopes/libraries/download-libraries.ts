import type { MappedArtifactType } from "@/types/launcher/libraries/mapped-artifact.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function downloadLibraries({
  necessaries,
  libraries,
  natives,
}: {
  "necessaries": PreLaunchInformationType;
  "libraries"  : Array<MappedArtifactType>;
  "natives"    : Array<MappedArtifactType>;
}): Promise<boolean> {}
