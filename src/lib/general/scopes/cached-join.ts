import { ApplicationNamespace } from "@/constants/application.ts";

export function cachedJoin(...paths: Array<string>): string {
  const delimiter = window[ApplicationNamespace].__internals.joinDelimiter;
  const cleanedPaths: Array<string> = [];

  for (const path of paths) {
    if (path !== "") {
      cleanedPaths.push(path);
    }
  }

  return cleanedPaths.join(delimiter);
}