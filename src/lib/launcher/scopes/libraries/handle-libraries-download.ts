import type {
  SpecificPatchLibraryType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function handleLibrariesDownload({
  libraries,
  necessaries,
}: {
  "libraries"  : Array<SpecificPatchLibraryType>;
  "necessaries": PreLaunchInformationType;
}): Promise<Array<string>> {
  const { statuses } = necessaries;
}
