import { downloadWithProgress } from "@/lib/launcher/scopes/download-with-progress.ts";
import { extractInstance } from "@/lib/launcher/scopes/extract-instance.ts";
import { fetchVersionMeta } from "@/lib/launcher/scopes/fetch-version-meta.ts";
import { getVersionMeta } from "@/lib/launcher/scopes/get-version-meta.ts";
import { launch } from "@/lib/launcher/scopes/launch.ts";
import { launchWithChecks } from "@/lib/launcher/scopes/launch-with-checks.ts";
import { validateSha1 } from "@/lib/launcher/scopes/validate-sha1.ts";

export default {
  downloadWithProgress,
  extractInstanceVersion: extractInstance,
  fetchVersionMeta,
  getVersionMeta,
  launch,
  launchWithChecks,
  validateSha1,
} as const;
