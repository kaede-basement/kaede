import { debug, error, info, warn } from "@tauri-apps/plugin-log";

/*
 * We do not care about promises here
 * Yeah, that can possibly lead to racing conditions...
 */
export const log = {
  "debug": (...input: string[]): void => {
    debug(input.join(" "));
  },
  "info": (...input: string[]): void => {
    info(input.join(" "));
  },
  "warn": (...input: string[]): void => {
    warn(input.join(" "));
  },
  "error": (...input: string[]): void => {
    error(input.join(" "));
  },
};
