import { extract } from "@/lib/errors/scopes/extract.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { NativeErrorType } from "@/types/application/error-handling.type.ts";

export function handleCapture(error: Error): NativeErrorType {
  const extractedError = extract(error);

  log.error(
    "A global error was captured:",
    extractedError.name + ":",
    extractedError.message + ";",
    "Stack:",
    extractedError
      .stack
      .split("\n")
      .map((line: string) => "[ERROR] " + line)
      .join("\n"),
  );

  return extractedError;
}