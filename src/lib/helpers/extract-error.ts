export function extractError(error: unknown): {
  "name"   : string;
  "message": string;
  "stack"  : string;
} {
  const safeError = {
    "name"   : "",
    "message": "",
    "stack"  : "",
  };

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
