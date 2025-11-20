import { getLogEntryInformation } from "@/lib/logging/scopes/get-log-entry-information.ts";
import { getLogFieldText } from "@/lib/logging/scopes/get-log-field-text.ts";
import { getLogLevelColor } from "@/lib/logging/scopes/get-log-level-color.ts";
import {
  handleVirtualListTextSelection,
} from "@/lib/logging/scopes/handle-virtual-list-text-selection.ts";
import { handleVirtualTextCopy } from "@/lib/logging/scopes/handle-virtual-text-copy.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import { prepareLogFile } from "@/lib/logging/scopes/prepare-log-file.ts";

export default {
  getLogEntryInformation,
  getLogFieldText,
  getLogLevelColor,
  handleVirtualListTextSelection,
  handleVirtualTextCopy,
  prepareLogFile,

  /* 'log' is used separately */
  log,
} as const;