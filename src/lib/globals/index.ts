import { declareWindow } from "@/lib/globals/scopes/declare-window.ts";
import { getLaunchCount } from "@/lib/globals/scopes/get-launch-count.ts";

export default {
  declareWindow,
  getLaunchCount,
} as const;