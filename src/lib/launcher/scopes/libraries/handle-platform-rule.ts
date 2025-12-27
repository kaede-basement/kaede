import type {
  SpecificPatchLibraryRuleType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";
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
  switch (platform) {
    case "windows": {
      switch (rule.os.name) {
        case "windows": {
          return rule.action === "allow";
        }
        case "windows-arm32": {
          return (arch === "arm32")
            ? (rule.action === "allow")
            : true;
        }
        case "windows-arm64": {
          return (arch === "arm64")
            ? (rule.action === "allow")
            : true;
        }
        default: {
          return rule.action === "allow";
        }
      }
    }
    case "linux": {
      switch (rule.os.name) {
        case "linux": {
          return rule.action === "allow";
        }
        case "linux-arm32": {
          return (arch === "arm32")
            ? (rule.action === "allow")
            : true;
        }
        case "linux-arm64": {
          return (arch === "arm64")
            ? (rule.action === "allow")
            : true;
        }
        default: {
          return rule.action === "allow";
        }
      }
    }
    case "macos": {
      switch (rule.os.name) {
        case "osx": {
          return rule.action === "allow";
        }
        case "osx-arm64": {
          return (arch === "arm64")
            ? (rule.action === "allow")
            : true;
        }
        default: {
          return rule.action === "allow";
        }
      }
    }
  }
}
