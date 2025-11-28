import { launch } from "@/lib/launcher/scopes/launch.ts";
import { launchWithChecks } from "@/lib/launcher/scopes/launch-with-checks.ts";

export default {
  launch,
  launchWithChecks,
} as const;