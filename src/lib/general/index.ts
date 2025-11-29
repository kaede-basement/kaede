import { nextTick } from "vue";

import { cachedJoin } from "@/lib/general/scopes/cached-join.ts";
import { capitalize } from "@/lib/general/scopes/capitalize.ts";
import { checkDaysDifference } from "@/lib/general/scopes/check-days-difference.ts";
import { checkIsPortable } from "@/lib/general/scopes/check-is-portable.ts";
import { getAtAGlance } from "@/lib/general/scopes/get-at-a-glance.ts";
import { getBaseDirectory } from "@/lib/general/scopes/get-base-directory.ts";
import { getExecutableDirectory } from "@/lib/general/scopes/get-executable-directory.ts";
import { getRelativeDate } from "@/lib/general/scopes/get-relative-date.ts";
import { getSidebarInnerStyles } from "@/lib/general/scopes/get-sidebar-inner-styles.ts";
import { initializeLauncher } from "@/lib/general/scopes/initialize-launcher.ts";

export default {
  "nextTick": async (): Promise<void> => {
    return await nextTick();
  },
  cachedJoin,
  capitalize,
  checkDaysDifference,
  checkIsPortable,
  getAtAGlance,
  getBaseDirectory,
  getExecutableDirectory,
  getRelativeDate,
  getSidebarInnerStyles,
  initializeLauncher,
} as const;
