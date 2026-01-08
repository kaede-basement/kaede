import ExtensionsManager from "@/lib/extensions-manager";
import { resolvePatchVersion } from "@/lib/launcher/scopes/patches/resolve-patch-version.ts";
import type { PatchRequiresType } from "@/types/launcher/meta/patch-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function resolvePatch({
  necessaries,
  versionMeta,
  metadata,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "metadata"   : PatchRequiresType;
}): Promise<Array<SpecificPatchMetaType>> {
  const beforeHooksResult: "continue" | Array<SpecificPatchMetaType> | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<SpecificPatchMetaType>>({
      "scope" : "onMinecraftPatchResolve",
      "toPass": { necessaries, versionMeta, metadata },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses } = necessaries;
  const version: string = await resolvePatchVersion({ necessaries, metadata });

  const afterHooksResult: "continue" | Array<SpecificPatchMetaType> | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<SpecificPatchMetaType>>({
      "scope" : "onMinecraftPatchResolve",
      "toPass": { necessaries, versionMeta, metadata },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }
}
