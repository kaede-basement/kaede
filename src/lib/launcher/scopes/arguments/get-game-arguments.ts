import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ParsedMetaType } from "@/types/launcher/meta/parsed-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getGameArguments({
  instanceId,
  necessaries,
  versionMeta,
  parsed,
}: {
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : ParsedMetaType;
}): Promise<string> {
  const beforeHooksResult: "continue" | string | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string>({
      "scope" : "onGameArgumentsGet",
      "toPass": { instanceId, necessaries, versionMeta, parsed },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Adding game arguments");

  if (versionMeta?.minecraftArguments === undefined) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not get game arguments from version meta",
    );

    throw new Error("No minecraft arguments found in the version metadata");
  }

  const tweakersList: Array<string> = versionMeta["+tweakers"] ?? [];
  const argumentsWithTweakers: Array<string> = [versionMeta.minecraftArguments];

  for (const tweaker of tweakersList) {
    argumentsWithTweakers.push(`--tweakClass ${tweaker}`);
  }

  const afterHooksResult: "continue" | string | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string>({
      "scope" : "onGameArgumentsGet",
      "toPass": { argumentsWithTweakers, instanceId, necessaries, versionMeta, parsed },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  return argumentsWithTweakers.join(" ");
}
