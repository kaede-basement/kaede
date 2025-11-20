import { capitalize } from "@/lib/general/scopes/capitalize.ts";
import { checkIsPortable } from "@/lib/general/scopes/check-is-portable.ts";
import { getAtAGlance } from "@/lib/general/scopes/get-at-a-glance.ts";
import { getBaseDirectory } from "@/lib/general/scopes/get-base-directory.ts";
import { getExecutableDirectory } from "@/lib/general/scopes/get-executable-directory.ts";
import { getRelativeDate } from "@/lib/general/scopes/get-relative-date.ts";
import { getSidebarInnerStyles } from "@/lib/general/scopes/get-sidebar-inner-styles.ts";
import { initializeLauncher } from "@/lib/general/scopes/initialize-launcher.ts";

export default {
  capitalize,
  checkIsPortable,
  getAtAGlance,
  getBaseDirectory,
  getExecutableDirectory,
  getRelativeDate,
  getSidebarInnerStyles,
  initializeLauncher,
} as const;
