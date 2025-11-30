import { ApplicationNamespace } from "@/constants/application.ts";

export function getCachedPortable(): boolean {
  return window[ApplicationNamespace].__internals.initialPortable;
}