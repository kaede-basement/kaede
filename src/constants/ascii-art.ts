import { arch, platform, version } from "@tauri-apps/plugin-os";

import { ApplicationName } from "@/constants/application.ts";

const date = (new Date).toISOString();

export function getASCIIArt(portable: boolean, launchCount: number): string {
  const launchStatus: string = window.__TAURI__ === undefined ? (
    "browser"
  ) : (
    launchCount === 0
      ? "clean"
      : `reloaded ${launchCount} times`
  );

  return (
    "\n" +
    "\n    __                  __   " +
    "  me@" + ApplicationName.toLowerCase() +
    "\n   / /______ ____  ____/ /__ " +
    "  os     " + platform() + " " + version() +
    "\n  / //_/ __ `/ _ \\/ __  / _ \\" +
    "  arch   " + arch() +
    "\n / ,< / /_/ /  __/ /_/ /  __/" +
    "  mode   " + (portable ? "portable" : "non-portable") +
    "\n/_/|_|\\__,_/\\___/\\__,_/\\___/ " +
    "  date   " + date +
    "\n                             " + "  launch " + launchStatus +
    "\n"
  );
}
