import { getVersion } from "@tauri-apps/api/app";

import { ApplicationName, ApplicationNamespace } from "@/constants/application.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function cacheLauncherVersion(): Promise<void> {
  const applicationVersion: string = await getVersion();

  log.debug(__PRE_BUNDLED_FILENAME__, `${ApplicationName} version:`, applicationVersion);
  window[ApplicationNamespace].__internals.launcherVersion = applicationVersion;
}
