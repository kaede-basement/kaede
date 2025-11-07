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
  "templates": {
    "hooks": {
      "iterate": {
        "start": (key: string, position: "before" | "after", length: number): string => [
          `Starting iterating through hooks for '${key}.${position}'.`,
          `Array length: ${length}`,
        ].join(" "),
        "end": (key: string, position: "before" | "after", time: number): string => (
          `All '${key}.${position}' hooks were executed in ${time} ms`
        ),
      },
    },
  },
};
