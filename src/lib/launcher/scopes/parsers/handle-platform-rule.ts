import { unifyPlatformWithArch } from "@/lib/launcher/scopes/parsers/unify-platform-with-arch.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchLibraryRuleType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { DeepRequired } from "@/types/utils/deep-required.type.ts";

export function handlePlatformRule({
  platform,
  arch,
  rule,
}: {
  "platform": PreLaunchInformationType["platform"];
  "arch"    : PreLaunchInformationType["arch"];
  "rule"    : DeepRequired<SpecificPatchLibraryRuleType>;
}): boolean {
  const {
    "platform": unifiedPlatform,
    "arch"    : unifiedArch,
  } = unifyPlatformWithArch(rule.os.name);
  const isCompatiblePlatform = unifiedPlatform === platform;
  const isCompatibleArch =
    unifiedArch === "any" ||
    unifiedArch === arch;

  // We care about the rule only if it targets the same platform and arch
  if (!isCompatiblePlatform || !isCompatibleArch) {
    return true;
  }

  return rule.action === "allow";
}
