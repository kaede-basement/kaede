import { ApplicationNamespace } from "@/constants/application.ts";
import { getConfigInstancesStates } from "@/lib/instances/scopes/get-config-instances-states.ts";
import { readStoredInstances } from "@/lib/instances/scopes/read-stored-instances.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export default {
  "get"   : (): InstanceStatesType => window[ApplicationNamespace].__internals.getInstanceStates(),
  "change": <Key extends keyof InstanceStatesType>(
    key: Key,
    value: InstanceStatesType[Key],
  ): void => window[ApplicationNamespace].__internals.changeInstanceStates(key, value),
  "getFromConfig": getConfigInstancesStates,
  "readStored"   : readStoredInstances,
} as const;