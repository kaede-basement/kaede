import { getLogEntryInformation } from "@/lib/logging/scopes/get-log-entry-information.ts";
import { getLogFieldText } from "@/lib/logging/scopes/get-log-field-text.ts";
import { getLogLevelColor } from "@/lib/logging/scopes/get-log-level-color.ts";
import {
  handleVirtualListTextSelection,
} from "@/lib/logging/scopes/handle-virtual-list-text-selection.ts";
import { handleVirtualTextCopy } from "@/lib/logging/scopes/handle-virtual-text-copy.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export default {
  getLogEntryInformation,
  getLogFieldText,
  getLogLevelColor,
  handleVirtualListTextSelection,
  handleVirtualTextCopy,

  /* 'log' is used separately */
  log,
} as const;