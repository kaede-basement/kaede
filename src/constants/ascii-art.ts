import { arch, platform, version } from "@tauri-apps/plugin-os";

import { ApplicationName } from "@/constants/application.ts";

export function getASCIIArt(portable: boolean, debug: boolean): string {
  return (
    "\n    __                  __   " +
    "  me@" + ApplicationName.toLowerCase() +
    "\n   / /______ ____  ____/ /__ " +
    "  os    " + platform() + " " + version() +
    "\n  / //_/ __ `/ _ \\/ __  / _ \\" +
    "  arch  " + arch() +
    "\n / ,< / /_/ /  __/ /_/ /  __/" +
    "  mode  " + (portable ? "portable" : "non-portable") +
    "\n/_/|_|\\__,_/\\___/\\__,_/\\___/ " +
    "  debug " + (
      debug ? "yes" : "no"
    ) +
    "\n                             "
  );
}
