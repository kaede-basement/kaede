import { debug, info, warn, error } from "@tauri-apps/plugin-log";

// We do not care about promises here
export const log = {
  "debug": (...input: unknown[]) => {
    debug(input.join(" "));
  },
  "info": (...input: unknown[]) => {
    info(input.join(" "));
  },
  "warn": (...input: unknown[]) => {
    warn(input.join(" "));
  },
  "error": (...input: unknown[]) => {
    error(input.join(" "));
  },
};
