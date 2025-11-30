import { ApplicationNamespace } from "@/constants/application.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export function getCachedInitial(): ConfigType {
  return window[ApplicationNamespace].__internals.initialConfig;
}