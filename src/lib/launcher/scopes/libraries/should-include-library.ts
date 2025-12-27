import type { Platform } from "@tauri-apps/plugin-os";

import { handlePlatformRule } from "@/lib/launcher/scopes/libraries/handle-platform-rule.ts";
import type {
  SpecificPatchLibraryRuleType,
  SpecificPatchLibraryType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function shouldIncludeLibrary({
  currentPlatform,
  library,
}: {
  "currentPlatform": Platform;
  "library"        : SpecificPatchLibraryType;
}): boolean {
  if (
    library?.rules === undefined ||
    !Array.isArray(library.rules)
  ) {
    return true;
  }

  let toInclude: boolean = true;
  const rules: Array<SpecificPatchLibraryRuleType> = library.rules;

  for (const rule of rules) {
    if (
      rule?.os === undefined ||
      rule?.os?.name === undefined
    ) {
      toInclude = rule?.action === "allow";

      continue;
    }

    toInclude = handlePlatformRule({
      currentPlatform,
      rule,
    });
  }

  return toInclude;
}
