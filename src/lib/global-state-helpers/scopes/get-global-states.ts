import { ApplicationNamespace } from "@/constants/application.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function getGlobalStates(): GlobalStatesType {
  return window[ApplicationNamespace].functions.getGlobalStates();
}