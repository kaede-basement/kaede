import { closeViewer } from "@/lib/logging/scopes/close-viewer.ts";
import { getLogEntryInformation } from "@/lib/logging/scopes/get-log-entry-information.ts";
import { getLogFieldText } from "@/lib/logging/scopes/get-log-field-text.ts";
import { getLogLevelColor } from "@/lib/logging/scopes/get-log-level-color.ts";
import { getLogTargetColor } from "@/lib/logging/scopes/get-log-target-color.ts";
import {
  handleVirtualListTextSelection,
} from "@/lib/logging/scopes/handle-virtual-list-text-selection.ts";
import { handleVirtualTextCopy } from "@/lib/logging/scopes/handle-virtual-text-copy.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import { readLogs } from "@/lib/logging/scopes/read-logs.ts";
import { selectAllText } from "@/lib/logging/scopes/select-all-text.ts";
import { toggleVirtualization } from "@/lib/logging/scopes/toggle-virtualization.ts";

export default {
  closeViewer,
  getLogEntryInformation,
  getLogFieldText,
  getLogLevelColor,
  getLogTargetColor,
  handleVirtualListTextSelection,
  handleVirtualTextCopy,
  selectAllText,
  readLogs,
  toggleVirtualization,

  /* 'log' is used separately */
  log,
} as const;
