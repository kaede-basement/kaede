import { ApplicationNamespace } from "@/constants/application.ts";
import { addInstanceWithSync } from "@/lib/instances/scopes/add-instance-with-sync.ts";
import { createInstance } from "@/lib/instances/scopes/create-instance.ts";
import { extractSavedFromPages } from "@/lib/instances/scopes/extract-saved-from-pages.ts";
import { findCurrent } from "@/lib/instances/scopes/find-current.ts";
import { getConfigInstanceStates } from "@/lib/instances/scopes/get-config-instance-states.ts";
import { getMinecraftDirectory } from "@/lib/instances/scopes/get-minecraft-directory.ts";
import { readStoredInstances } from "@/lib/instances/scopes/read-stored-instances.ts";
import { saveInstanceStatesToFile } from "@/lib/instances/scopes/save-instance-states-to-file.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export default {
  "get"   : (): InstanceStatesType => window[ApplicationNamespace].__internals.getInstanceStates(),
  "change": <Key extends keyof InstanceStatesType>(
    key: Key,
    value: InstanceStatesType[Key],
  ): void => window[ApplicationNamespace].__internals.changeInstanceStates(key, value),
  "add"          : addInstanceWithSync,
  "create"       : createInstance,
  "getFromConfig": getConfigInstanceStates,
  "readStored"   : readStoredInstances,
  "syncMetadata" : saveInstanceStatesToFile,
  extractSavedFromPages,
  getMinecraftDirectory,
  findCurrent,
} as const;
