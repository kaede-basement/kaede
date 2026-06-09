import { GlobalInternals } from "@/extendable/global-internals.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export function getCachedInitial(): ConfigType {
  return GlobalInternals.initialConfig;
}