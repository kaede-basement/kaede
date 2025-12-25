import { cacheLauncherVersion } from "@/lib/globals/scopes/cache-launcher-version.ts";
import { cachePathJoin } from "@/lib/globals/scopes/cache-path-join.ts";
import { declareWindow } from "@/lib/globals/scopes/declare-window.ts";
import { getLaunchCount } from "@/lib/globals/scopes/get-launch-count.ts";

export default {
  cacheLauncherVersion,
  cachePathJoin,
  declareWindow,
  getLaunchCount,
} as const;
