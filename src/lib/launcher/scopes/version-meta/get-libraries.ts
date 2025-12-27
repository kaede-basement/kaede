import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { getAllowedLibraries } from "@/lib/launcher/scopes/libraries/get-allowed-libraries.ts";
import {
  handleLibrariesDownload,
} from "@/lib/launcher/scopes/libraries/handle-libraries-download.ts";
import type {
  SpecificPatchLibraryType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export async function getLibraries({
  necessaries,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<Array<string> | false> {
  const beforeHooksResult: "continue" | Array<string> | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<string> | false>({
      "scope" : "onMinecraftLibrariesGet",
      "toPass": { necessaries, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { statuses } = necessaries;
  const libraries: SpecificPatchMetaType["libraries"] = versionMeta?.libraries;

  if (
    libraries === undefined ||
    !Array.isArray(libraries)
  ) {
    statuses.add(LaunchStatus.Errors.LibrariesMissingMeta);

    return false;
  }

  const allowedLibraries: Array<SpecificPatchLibraryType> = getAllowedLibraries({
    necessaries,
    libraries,
  });

  const libraryPaths: Array<string> = await handleLibrariesDownload({
    "libraries": allowedLibraries,
    necessaries,
  });

  const afterHooksResult: "continue" | Array<string> | false | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<string> | false>({
      "scope" : "onMinecraftLibrariesGet",
      "toPass": { necessaries, versionMeta, "paths": libraryPaths },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  statuses.add(LaunchStatus.Libraries.Done);

  return libraryPaths;
}
