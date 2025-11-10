import { extract } from "@/lib/errors/scopes/extract.ts";

export function prettify(error: unknown): string {
  const extracted = extract(error);

  return [
    extracted.name + ":",
    extracted.message + ";",
    "Stack:",
    "\n" + extracted.stack,
  ].join(" ");
}