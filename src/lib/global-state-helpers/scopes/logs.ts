import { ApplicationNamespace } from "@/constants/application.ts";
import { getGlobalStates } from "@/lib/global-state-helpers/scopes/get-global-states.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

function toggle<Key extends keyof GlobalStatesType["logs"]>(
  key: Key,
  state?: boolean,
): void {
  const logs = getGlobalStates().logs;

  if (typeof logs[key] !== "boolean") {
    return;
  }

  const newLogs = {
    ...logs,
    [key]: state ?? !logs[key],
  };

  window[ApplicationNamespace].functions.changeGlobalStates("logs", newLogs);
}

export const Logs = {
  toggle,
};