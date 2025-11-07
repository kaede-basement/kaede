import { log } from "@/lib/handlers/log.ts";
import { extractError } from "@/lib/helpers/extract-error.ts";

export function handleErrorCapture(error: Error): ReturnType<typeof extractError> {
  const extractedError = extractError(error);

  log.error(
    "A global error was captured:",
    extractedError.name + ":",
    extractedError.message + ";",
    "Stack:",
    extractedError.stack,
  );

  return extractedError;
}