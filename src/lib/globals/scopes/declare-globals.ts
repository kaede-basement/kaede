import { cancel, onInvalidUrl, onUrl, start } from "@fabianlars/tauri-plugin-oauth";
import * as DiscordRPC from "tauri-plugin-drpc";
import * as DiscordRPCClasses from "tauri-plugin-drpc/activity.ts";
import * as ShellXPlugin from "tauri-plugin-shellx-api";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { GlobalObject } from "@/extendable/global-object.ts";

export function declareGlobals(): void {
  window.__TAURI_PLUGINS_COMMUNITY__ = {
    "discord": {
      ...DiscordRPC,
      ...DiscordRPCClasses,
    },
    "oauth2": {
      cancel,
      onInvalidUrl,
      onUrl,
      start,
    },
    "shell": {
      ...ShellXPlugin,
    },
  };
  window.__KAEDE_INTERNALS__ = GlobalInternals;
  window.__KAEDE__ = GlobalObject;
}
