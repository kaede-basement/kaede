import { extract } from "@/lib/errors/scopes/extract.ts";

export function stringify(error: unknown): string {
  return JSON.stringify(extract(error));
}