import type { LogEntryInformationType } from "@/types/logging/log-entry-information.type.ts";

export function getLogEntryInformation(line: string | [number, string]): LogEntryInformationType {
  const current: {
    "date"   : string;
    "time"   : string;
    "target" : string;
    "level"  : string;
    "message": string;
  } = {
    "date"   : "",
    "time"   : "",
    "target" : "",
    "level"  : "",
    "message": "",
  };
  const actualLine = typeof line === "string" ? line : line[1];

  /*
   * Log entries start with the square bracket symbol and the date.
   * If the character after the '[' symbol is not a number,
   * then the provided line is not a log entry
   */
  if (actualLine?.[0] !== "[" || Number.isNaN(
    Number(actualLine?.[1]),
  )) {
    current.time = actualLine;

    return current;
  }

  const parts = actualLine.split("]");

  if (actualLine.startsWith("__kaede-trigger-initial")) {
    current.target = "All logs will be displayed here ᓀ‸ᓂ";

    return current;
  }

  if (actualLine.startsWith("__kaede-trigger-virtualized")) {
    current.target = "Virtualized mode. All logs will be displayed here ᓀ‸ᓂ";

    return current;
  }

  if (actualLine.startsWith("__kaede-trigger-loading")) {
    current.target = "Loading your logs...";

    return current;
  }

  for (const [partIndex, part] of parts.entries()) {
    switch (partIndex) {
      case 0: {
        if (parts.length === 1) {
          current.time = part;

          break;
        }

        current.date = "[ " + part.slice(1) + " ]";

        break;
      }
      case 1: {
        current.time = "[ " + part.slice(1) + " ]";

        break;
      }
      case 2: {
        // If true, then the target part is empty
        if (part.startsWith(" ")) {
          current.level = "[ " + part.trim().slice(1) + " ]";

          break;
        }

        if (part.startsWith("[webview:")) {
          const targetParts = part.split("/");

          current.target = "[ " + targetParts[targetParts.length - 1] + " ]";

          break;
        }

        current.target = "[ " + part.slice(1) + " ]";

        break;
      }
      case 3: {
        // If true, then the target part is empty
        if (current.level !== "") {
          current.message = part;

          break;
        }

        current.level = "[ " + part.slice(1) + " ]";

        break;
      }
      default: {
        // If true, then we stumbled upon a closing bracket in the message
        if (partIndex !== parts.length - 1) {
          current.message = current.message + part + "]";

          break;
        }

        current.message = current.message + part;

        break;
      }
    }
  }

  return current;
}