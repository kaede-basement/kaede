import { declareWindow } from "@/lib/globals/scopes/declare-window.ts";
import { getLaunchCount } from "@/lib/globals/scopes/get-launch-count.ts";
import { handlePathJoin } from "@/lib/globals/scopes/handle-path-join.ts";

export default {
  declareWindow,
  getLaunchCount,
  handlePathJoin,
} as const;