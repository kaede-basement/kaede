import "ses";

import { readTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import { throwIfAborted } from "@/lib/extensions/sandbox/abort.ts";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import { hardenIfAvailable } from "@/lib/permissions/harden.ts";

export function handleLoggingPermission({ id, scope, signal }: {
  "signal"?: AbortSignal;
  "id"     : string;
  "scope"  : "write" | "read";
}): unknown {
  switch (scope) {
    case "write": {
      const wrappedLog = (
        method: "debug" | "info" | "warn" | "error",
        ...input: Array<string>
      ): void => {
        throwIfAborted(signal);

        return log[method](`${id}`, ...input);
      };

      return hardenIfAvailable({
        "debug": (...input: Array<string>): void => wrappedLog("debug", ...input),
        "info" : (...input: Array<string>): void => wrappedLog("info", ...input),
        "warn" : (...input: Array<string>): void => wrappedLog("warn", ...input),
        "error": (...input: Array<string>): void => wrappedLog("error", ...input),
      });
    }
    case "read": {
      const readLogFile = async (): Promise<string> => {
        throwIfAborted(signal);
        const path: string = FileManager.join(
          FileManager.getBaseDirectory(),
          FileStructure.Folders.Logs.Path,
          FileStructure.Folders.Logs.Files.LatestLog,
        );
        const current: string = await readTextFile(path);

        throwIfAborted(signal);
        log.debug(__PRE_BUNDLED_FILENAME__, `The '${id}' plugin has read logs`);

        return current;
      };

      return hardenIfAvailable(readLogFile);
    }
  }
}
