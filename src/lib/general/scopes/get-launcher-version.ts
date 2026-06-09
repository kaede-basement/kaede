import { GlobalInternals } from "@/extendable/global-internals.ts";

export function getLauncherVersion(): string {
  return GlobalInternals.launcherVersion;
}
