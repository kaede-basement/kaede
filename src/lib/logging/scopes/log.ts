import { debug, error, info, warn } from "@tauri-apps/plugin-log";

import { capitalize } from "@/lib/general/scopes/capitalize.ts";

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
        "start": (key: string, position: "before" | "after", length: number): string => (
          [
            `Starting iterating through hooks for '${key}.${position}'.`,
            `Array length: ${length}`,
          ].join(" ")
        ),
        "execution": (
          key: string,
          position: "before" | "after",
          index: number,
          type: "sync" | "async",
        ): string => (
          `'${key}.${position}' iterate: '${index}' index. ${capitalize(type)} hook execution`
        ),
        "response": (
          key: string,
          value: unknown,
          position: "before" | "after",
          index: number,
          time: number,
        ): string => (
          [
            `'${key}.${position}' iterate: '${index}' index.`,
            `Hook execution ended in ${time} ms.`,
            `Hook response: \n${JSON.stringify(value, null, 2)}`,
          ].join(" ")
        ),
        "no-response": (
          key: string,
          position: "before" | "after",
          index: number,
          time: number,
          type: "sync" | "async",
        ): string => (
          [
            `'${key}.${position}' iterate: '${index}' index.`,
            `${capitalize(type)} hook executed in ${time} ms`,
          ].join(" ")
        ),
        "end": (key: string, position: "before" | "after", time: number): string => (
          `All '${key}.${position}' hooks were executed in ${time} ms`
        ),
      },
    },
  },
};
