import { getVersion } from "@tauri-apps/api/app";

import { ApplicationName } from "@/constants/application.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function cacheLauncherVersion(): Promise<void> {
  const applicationVersion: string = await getVersion();

  log.debug(__PRE_BUNDLED_FILENAME__, `${ApplicationName} version:`, applicationVersion);
  GlobalInternals.launcherVersion = applicationVersion;
}
