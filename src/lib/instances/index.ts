import { ApplicationNamespace } from "@/constants/application.ts";
import { findCurrent } from "@/lib/instances/scopes/find-current.ts";
import { getConfigInstanceStates } from "@/lib/instances/scopes/get-config-instance-states.ts";
import { readStoredInstances } from "@/lib/instances/scopes/read-stored-instances.ts";
import { saveInstanceStatesToFile } from "@/lib/instances/scopes/save-instance-states-to-file.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export default {
  "get"   : (): InstanceStatesType => window[ApplicationNamespace].__internals.getInstanceStates(),
  "change": <Key extends keyof InstanceStatesType>(
    key: Key,
    value: InstanceStatesType[Key],
  ): void => window[ApplicationNamespace].__internals.changeInstanceStates(key, value),
  "getFromConfig": getConfigInstanceStates,
  "readStored"   : readStoredInstances,
  "syncMetadata" : saveInstanceStatesToFile,
  findCurrent,
} as const;