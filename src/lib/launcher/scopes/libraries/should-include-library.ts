import { handlePlatformRule } from "@/lib/launcher/scopes/libraries/handle-platform-rule.ts";
import type {
  SpecificPatchLibraryOSNameType,
  SpecificPatchLibraryRuleType,
  SpecificPatchLibraryType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export function shouldIncludeLibrary({
  necessaries,
  library,
}: {
  "necessaries": PreLaunchInformationType;
  "library"    : SpecificPatchLibraryType;
}): boolean {
  if (
    library?.rules === undefined ||
    !Array.isArray(library.rules)
  ) {
    return true;
  }

  const { platform, arch } = necessaries;
  const rules: Array<SpecificPatchLibraryRuleType> = library.rules;
  let toInclude: boolean = true;

  for (const rule of rules) {
    const ruleOS: SpecificPatchLibraryOSNameType | undefined = rule?.os?.name;

    if (ruleOS === undefined) {
      toInclude = rule?.action === "allow";

      continue;
    }

    toInclude = handlePlatformRule({
      "rule": {
        "action": rule?.action ?? "disallow",
        "os"    : {
          "name": ruleOS,
        },
      },
      platform,
      arch,
    });
  }

  return toInclude;
}
