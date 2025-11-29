import type { NativeErrorType } from "@/types/errors/error-handling.type.ts";

export function extract(error: unknown): NativeErrorType {
  const safeError = {
    "name"   : "Unknown Error",
    "message": "unknown",
    "stack"  : "Unknown Error: unknown",
  };

  // Some errors are string typed
  if (typeof error === "string") {
    safeError.stack = error;

    return safeError;
  }

  if (typeof error !== "object" || error === null) {
    return safeError;
  }

  if ("name" in error && typeof error.name === "string") {
    safeError.name = error.name;
  }

  if ("message" in error && typeof error.message === "string") {
    safeError.message = error.message;
  }

  if ("stack" in error && typeof error.stack === "string") {
    safeError.stack = error.stack;
  }

  return safeError;
}