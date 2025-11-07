import { log } from "@/lib/logging/scopes/log.ts";
import { prepareLogFile } from "@/lib/logging/scopes/prepare-log-file.ts";

export default {
  prepareLogFile,

  /* 'log' is used separately */
  log,
} as const;