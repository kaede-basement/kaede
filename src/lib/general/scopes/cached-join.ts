import { GlobalInternals } from "@/extendable/global-internals.ts";

export function cachedJoin(...paths: Array<string>): string {
  const delimiter = GlobalInternals.joinDelimiter;
  const cleanedPaths: Array<string> = [];

  for (const path of paths) {
    if (path !== "") {
      cleanedPaths.push(path);
    }
  }

  return cleanedPaths.join(delimiter);
}