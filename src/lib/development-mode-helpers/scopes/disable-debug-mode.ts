import { log } from "@/lib/logging/scopes/log.ts";

export function disableDebugMode(): void {
  log.debug = log["__debug-undefined"];
  log.info("Debug mode disabled");
}
