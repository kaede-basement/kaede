import { capitalize } from "@/lib/general/scopes/capitalize.ts";
import { getRelativeDate } from "@/lib/general/scopes/get-relative-date.ts";
import { initializeLauncher } from "@/lib/general/scopes/initialize-launcher.ts";

export default {
  capitalize,
  getRelativeDate,
  initializeLauncher,
} as const;