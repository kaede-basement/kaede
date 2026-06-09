import { GlobalInternals } from "@/extendable/global-internals.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export function getConfigInstanceStates(): InstanceStatesType {
  /*
   * Initial instances metadata were provided by the 'main.ts' code
   */
  return GlobalInternals.initialInstances;
}