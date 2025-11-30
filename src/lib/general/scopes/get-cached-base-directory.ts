import { ApplicationNamespace } from "@/constants/application.ts";

export function getCachedBaseDirectory(): string {
  return window[ApplicationNamespace].__internals.initialBaseDirectory;
}