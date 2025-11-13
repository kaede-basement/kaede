import { log } from "@/lib/logging/scopes/log.ts";

export function handleNativeReloadKeyBinds(event: KeyboardEvent, ignore: boolean): void {
  // If user has enabled native reload key binds, then do not prevent them from firing
  if (ignore) {
    return;
  }

  if (
    event.key === "F5" ||
    (event.ctrlKey && event.key === "r") ||
    (event.metaKey && event.key === "r")
  ) {
    log.debug("Prevented native behaviour when triggering reload key binds");
    event.preventDefault();
  }
}
