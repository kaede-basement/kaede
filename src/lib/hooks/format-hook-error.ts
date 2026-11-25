import Errors from "@/lib/errors";

export function formatHookError(error: unknown): string {
  try {
    return Errors.prettify(error);
  } catch {
    return "Unreadable thrown value";
  }
}
