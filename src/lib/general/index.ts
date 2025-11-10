import { capitalize } from "@/lib/general/scopes/capitalize.ts";
import { checkIsPortable } from "@/lib/general/scopes/check-is-portable.ts";
import { getExecutableDirectory } from "@/lib/general/scopes/get-executable-directory.ts";
import { getRelativeDate } from "@/lib/general/scopes/get-relative-date.ts";
import { initializeLauncher } from "@/lib/general/scopes/initialize-launcher.ts";

export default {
  capitalize,
  checkIsPortable,
  getExecutableDirectory,
  getRelativeDate,
  initializeLauncher,
} as const;