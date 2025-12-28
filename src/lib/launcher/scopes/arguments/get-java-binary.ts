import ExtensionsManager from "@/lib/extensions-manager";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function getJavaBinary({
  necessaries,
  versionMeta,
}: {
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
}): Promise<"java" | "cmd"> {
  const beforeHooksResult: "continue" | "java" | "cmd" | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<"java" | "cmd">({
      "scope" : "onJavaBinaryGet",
      "toPass": { necessaries, versionMeta },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { platform } = necessaries;

  switch (platform) {
    case "windows": {
      return "cmd";
    }
    default: {
      return "java";
    }
  }
}
