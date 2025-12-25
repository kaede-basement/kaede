import { getVersion } from "@tauri-apps/api/app";

import { ApplicationName, ApplicationNamespace } from "@/constants/application.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function cacheLauncherVersion(): Promise<void> {
  const applicationVersion: string = await getVersion();

  log.debug(`${ApplicationName} version:`, applicationVersion);
  window[ApplicationNamespace].__internals.launcherVersion = applicationVersion;
}
