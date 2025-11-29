import { ApplicationNamespace } from "@/constants/application.ts";
import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function getCachedManifestV2Path(
  fileSystemStates: GlobalStatesType["fileSystem"],
): string {
  let cachePath: string | undefined = fileSystemStates?.folders?.cache;

  if (!cachePath) {
    // Should never occur, but better to be safe
    cachePath = General.cachedJoin(
      window[ApplicationNamespace].__internals.initialBaseDirectory,
      FileStructure.Cache.Path,
    );
  }

  return General.cachedJoin(
    cachePath,
    FileStructure.Cache.Files.ManifestV2,
  );
}