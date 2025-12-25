import { ApplicationNamespace } from "@/constants/application.ts";

export function getLauncherVersion(): string {
  return window[ApplicationNamespace].__internals.launcherVersion;
}
