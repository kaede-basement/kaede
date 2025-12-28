import { downloadWithProgress } from "@/lib/launcher/scopes/fetching/download-with-progress.ts";
import { extractInstance } from "@/lib/launcher/scopes/extractors/extract-instance.ts";
import { fetchVersionMeta } from "@/lib/launcher/scopes/fetching/fetch-version-meta.ts";
import { getVersionMeta } from "@/lib/launcher/scopes/version-meta/get-version-meta.ts";
import { launch } from "@/lib/launcher/scopes/launch.ts";
import { launchWithChecks } from "@/lib/launcher/scopes/launch-with-checks.ts";

export default {
  downloadWithProgress,
  extractInstance,
  fetchVersionMeta,
  getVersionMeta,
  launch,
  launchWithChecks,
} as const;
