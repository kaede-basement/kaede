import { join } from "@tauri-apps/api/path";

import { ApplicationNamespace } from "@/constants/application.ts";
import { log } from "@/lib/logging/scopes/log.ts";

const Placeholder = "buh";

export async function handlePathJoin(): Promise<void> {
  // We don't care about promise rejection here, since we can't do much about error
  const joined = await join(Placeholder, Placeholder);
  // Extract the delimiter by removing 3 characters from both ends
  const delimiter = joined.slice(Placeholder.length, -1 * Placeholder.length);

  log.debug("Current path delimiter:", delimiter);
  window[ApplicationNamespace].__internals.joinDelimiter = delimiter;
}