import { ApplicationNamespace } from "@/constants/application.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export function getConfigInstanceStates(): InstanceStatesType {
  /*
   * Initial instances metadata were provided by the 'main.ts' code
   */
  return window[ApplicationNamespace].__internals.initialInstances;
}