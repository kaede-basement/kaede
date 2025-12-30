import ExtensionsManager from "@/lib/extensions-manager";
import type { ParsedMetaType } from "@/types/launcher/meta/parsed-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getAdditionalStartArguments({
  javaBinary,
  instanceId,
  necessaries,
  versionMeta,
  parsed,
}: {
  "javaBinary" : string;
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : ParsedMetaType;
}): Promise<string> {
  const beforeHooksResult: "continue" | string | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string>({
      "scope" : "onAdditionalStartArgumentsGet",
      "toPass": { javaBinary, instanceId, necessaries, versionMeta, parsed },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  return javaBinary === "cmd" ? "/C javaw" : "";
}
