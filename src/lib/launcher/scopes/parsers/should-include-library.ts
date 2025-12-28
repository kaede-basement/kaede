import { handlePlatformRule } from "@/lib/launcher/scopes/parsers/handle-platform-rule.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchLibraryOSNameType,
  SpecificPatchLibraryRuleType,
  SpecificPatchLibraryType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

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
    const parsedOS: SpecificPatchLibraryOSNameType | undefined = rule?.os?.name;

    if (parsedOS === undefined) {
      toInclude = rule?.action === "allow";

      continue;
    }

    toInclude = handlePlatformRule({
      "rule": {
        "action": rule?.action ?? "disallow",
        "os"    : {
          "name": parsedOS,
        },
      },
      platform,
      arch,
    });
  }

  return toInclude;
}
