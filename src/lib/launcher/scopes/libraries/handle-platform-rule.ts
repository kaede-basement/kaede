import type { Platform } from "@tauri-apps/plugin-os";

import type {
  SpecificPatchLibraryRuleType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { DeepRequired } from "@/types/utils/deep-required.type.ts";

export function handlePlatformRule({
  currentPlatform,
  rule,
}: {
  "currentPlatform": Platform;
  "rule"           : DeepRequired<SpecificPatchLibraryRuleType>;
}): boolean {
  let allow: boolean = false;

  switch (currentPlatform) {
    case "windows": {
      switch (rule.os.name) {
        case "windows": {
          break;
        }
        case "windows-arm32": {}
        case "windows-arm64": {}
      }

      break;
    }
    case "linux": {
      break;
    }
    case "macos": {
      break;
    }
  }

  return allow;
}
