import { debug, info, warn, error } from "@tauri-apps/plugin-log";

/*
 * We do not care about promises here
 * Yeah, that can lead to racing conditions...
 * TODO: batch these log operations maybe?
 */
export const log = {
  "debug": (...input: string[]) => {
    debug(input.join(" "));
  },
  "info": (...input: string[]) => {
    info(input.join(" "));
  },
  "warn": (...input: string[]) => {
    warn(input.join(" "));
  },
  "error": (...input: string[]) => {
    error(input.join(" "));
  },
};
