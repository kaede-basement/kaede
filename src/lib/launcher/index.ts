import { extractInstanceVersion } from "@/lib/launcher/scopes/extract-instance-version.ts";
import { launch } from "@/lib/launcher/scopes/launch.ts";
import { launchWithChecks } from "@/lib/launcher/scopes/launch-with-checks.ts";

export default {
  extractInstanceVersion,
  launch,
  launchWithChecks,
} as const;
