import { invoke } from "@tauri-apps/api/core";

import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

export async function getLaunchCount(): Promise<number> {
  let count: number;

  try {
    count = await invoke("get_launched_state");
  } catch (error: unknown) {
    log.error("Failed to retrieve application launch count:", Errors.prettify(error));
    count = 0;
  }

  return count;
}