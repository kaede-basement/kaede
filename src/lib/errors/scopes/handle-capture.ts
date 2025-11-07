import { extract } from "@/lib/errors/scopes/extract.ts";
import type { NativeErrorType } from "@/types/application/error-handling.type.ts";
import Log from "@/lib/log";

export function handleCapture(error: Error): NativeErrorType {
  const extractedError = extract(error);

  Log.Error(
    "A global error was captured:",
    extractedError.name + ":",
    extractedError.message + ";",
    "Stack:",
    extractedError.stack,
  );

  return extractedError;
}