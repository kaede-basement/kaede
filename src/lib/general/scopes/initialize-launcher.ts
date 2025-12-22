import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { exists, mkdir } from "@tauri-apps/plugin-fs";

import { ApplicationNamespace } from "@/constants/application.ts";
import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function initializeLauncher({
  config,
  baseDirectory,
  startTime,
}: {
  "config"       : ConfigType;
  "baseDirectory": string;
  "startTime"    : number;
}): Promise<void> {
  const afterExtensions =
    config.extensions.enabled &&
    config.misc.showAfterExtensionsInitialization;

  if (afterExtensions) {
    /*
     * Making the webview window visible determines that the launcher successfully started.
     *
     * Clearly, the 'startTime' variable is not accessible by the deeply nested
     * 'ExtensionLoader.vue' component without exposing that variable through the 'window' object.
     */
    window[ApplicationNamespace].__internals.startTime = startTime;
  } else {
    /*
     * Webview window is still hidden, so make it visible now
     * because frontend is already loaded by this time
     */
    log.debug("Making current webview window visible");
    await getCurrentWebviewWindow().show();

    log.info(
      "Launcher successfully initialized in:",
      (performance.now() - startTime).toFixed(1),
      "ms",
    );
  }

  log.debug("Checking if all directories present");
  const directoriesStartTime = performance.now();

  const assetsPath = General.cachedJoin(baseDirectory, FileStructure.Folders.Assets.Path);
  const librariesPath = General.cachedJoin(baseDirectory, FileStructure.Folders.Libraries.Path);
  const cachePath = General.cachedJoin(baseDirectory, FileStructure.Folders.Cache.Path);
  const instancesPath = General.cachedJoin(baseDirectory, FileStructure.Folders.Instances.Path);
  const extensionsPath = General.cachedJoin(baseDirectory, FileStructure.Folders.Extensions.Path);
  const resourcesPath = General.cachedJoin(baseDirectory, FileStructure.Folders.Resources.Path);
  const themesPath = General.cachedJoin(baseDirectory, FileStructure.Folders.Themes.Path);

  const directories: Array<string> = [
    cachePath,
    instancesPath,
    extensionsPath,
    resourcesPath,
    themesPath,
  ];
  const toCreate: Array<string> = [];

  const statuses: Array<boolean> = await Promise.all(
    directories.map(directory => exists(directory)),
  );

  for (const [index, status] of statuses.entries()) {
    if (!status) {
      toCreate.push(directories[index]);
    }
  }

  if (toCreate.length === 0) {
    log.info(
      "All launcher directories present. Time spent to check:",
      (performance.now() - directoriesStartTime).toFixed(1),
      "ms",
    );

    return;
  }

  await Promise.all(
    toCreate.map(directory => mkdir(directory)),
  );

  log.info(
    "Created all launcher directories in:",
    (performance.now() - directoriesStartTime).toFixed(1),
    "ms",
  );
}
