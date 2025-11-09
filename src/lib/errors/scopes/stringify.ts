import { extract } from "@/lib/errors/scopes/extract.ts";

export function stringify(error: unknown, prefix?: boolean): string {
  const extracted = extract(error);

  if (prefix) {
    return JSON.stringify({
      "name"   : extracted.name,
      "message": extracted.message,
      "stack"  : extracted.stack,
    }, null, 2);
  }

  return JSON.stringify(extracted);
}