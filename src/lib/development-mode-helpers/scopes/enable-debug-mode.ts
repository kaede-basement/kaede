import { log } from "@/lib/logging/scopes/log.ts";

export function enableDebugMode(): void {
  log.debug = log["__debug-defined"];
  log.warn("Debug mode enabled");
}
