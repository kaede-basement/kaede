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

  log.debug("Adding game arguments");

  if (versionMeta?.minecraftArguments === undefined) {
    log.error("Could not get game arguments from version meta");

    throw new Error("No minecraft arguments found in the version metadata");
  }

  const tweakersList: Array<string> = versionMeta["+tweakers"] ?? [];
  const argumentsWithTweakers: Array<string> = [versionMeta.minecraftArguments];

  for (const tweaker of tweakersList) {
    argumentsWithTweakers.push(`--tweakClass ${tweaker}`);
  }

  return argumentsWithTweakers.join(" ");
}
