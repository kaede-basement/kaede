import type { LogEntryInformationType } from "@/types/logging/log-entry-information.type.ts";

export function getLogEntryInformation(line: string | [number, string]): LogEntryInformationType {
  const current: LogEntryInformationType = {
    "time"   : "",
    "level"  : "",
    "target" : "",
    "message": "",
  };
  const actualLine = typeof line === "string" ? line : line[1];

  switch (actualLine) {
    case "__kaede-trigger-initial": {
      current.target = "All logs will be displayed here ᓀ‸ᓂ";

      return current;
    }
    case "__kaede-trigger-virtualized": {
      current.target = "Virtualized mode. All logs will be displayed here ᓀ‸ᓂ";

      return current;
    }
    case "__kaede-trigger-loading": {
      current.target = "Loading your logs...";

      return current;
    }
  }

  /*
   * Log entries start with the time.
   * If the first character is not a number,
   * then the provided line is not a log entry
   */
  const isLogEntry = !Number.isNaN(Number(actualLine?.[0]));

  if (!isLogEntry) {
    current.time = actualLine;

    return current;
  }

  const parts = actualLine.split(" | ");

  current.time = parts?.[0] ?? "";
  current.level = parts?.[1] ?? "";
  current.target = parts?.[2] ?? "";
  current.message = parts.slice(3).join(" | ");

  return current;
}
